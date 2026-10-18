// Felles hjelper: bruker Firebase CLI-innloggingen (firebase login) som eier av prosjektet.
// Eier-tilgang går forbi sikkerhetsreglene, så bruk dette bare for vertsoppgaver.
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';

export const PROJECT = process.env.HYTTELAN_PROJECT || 'hyttelan-hovden';
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;

async function token() {
  const c = JSON.parse(readFileSync(homedir() + '/.config/configstore/firebase-tools.json', 'utf8'));
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ refresh_token: c.tokens.refresh_token, grant_type: 'refresh_token',
      client_id: '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com', client_secret: 'j9iVZfS8kkCEFUPaAeJV0sAi' })
  });
  const j = await r.json(); if (!j.access_token) throw new Error('Kjør `firebase login` først.'); return j.access_token;
}
const val = v => v.stringValue ?? v.booleanValue ?? (v.integerValue !== undefined ? Number(v.integerValue) : v.doubleValue ?? v.timestampValue ?? null);

export async function list(collection) {
  const t = await token(), out = []; let page = '';
  do {
    const r = await fetch(`${BASE}/${collection}?pageSize=300${page ? '&pageToken=' + page : ''}`, { headers: { authorization: 'Bearer ' + t } });
    const j = await r.json(); if (j.error) throw new Error(j.error.message);
    for (const d of j.documents || []) out.push({ id: d.name.split('/').pop(), ...Object.fromEntries(Object.entries(d.fields || {}).map(([k, v]) => [k, val(v)])) });
    page = j.nextPageToken;
  } while (page);
  return out;
}
export async function remove(collection, id) {
  const r = await fetch(`${BASE}/${collection}/${id}`, { method: 'DELETE', headers: { authorization: 'Bearer ' + await token() } });
  if (!r.ok) throw new Error(await r.text());
}
export async function write(collection, id, data) {
  const enc = v => typeof v === 'number' ? { integerValue: String(v) } : { stringValue: String(v) };
  const fields = Object.fromEntries(Object.entries(data).map(([k, v]) => [k, enc(v)]));
  const r = await fetch(`${BASE}/${collection}/${id}`, { method: 'PATCH', headers: { authorization: 'Bearer ' + await token(), 'content-type': 'application/json' }, body: JSON.stringify({ fields }) });
  if (!r.ok) throw new Error(await r.text());
}
