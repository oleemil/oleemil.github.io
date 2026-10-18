// Flytter en spiller til et annet lag (første ledige plass). Bruk: node hyttelan/verktoy/flytt.mjs p02 2
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { PROJECT } from './firestore-admin.mjs';
const [pid, lag] = [process.argv[2], Number(process.argv[3])];
if (!/^p\d\d$/.test(pid || '') || !Number.isInteger(lag)) { console.error('Bruk: node flytt.mjs p02 2'); process.exit(1); }
const cfg = JSON.parse(readFileSync(new URL('../data/lan.json', import.meta.url)));
const c = JSON.parse(readFileSync(homedir() + '/.config/configstore/firebase-tools.json', 'utf8'));
const t = (await (await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ refresh_token: c.tokens.refresh_token, grant_type: 'refresh_token', client_id: '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com', client_secret: 'j9iVZfS8kkCEFUPaAeJV0sAi' }) })).json()).access_token;
const ROOT = `projects/${PROJECT}/databases/(default)/documents`, B = 'https://firestore.googleapis.com/v1/' + ROOT, H = { authorization: 'Bearer ' + t, 'content-type': 'application/json' };
const cur = await (await fetch(`${B}/players/${pid}`, { headers: H })).json();
if (!cur.fields) { console.error(pid + ' er ikke påmeldt.'); process.exit(1); }
const slots = (await (await fetch(`${B}/slots?pageSize=300`, { headers: H })).json()).documents || [];
const taken = new Set(slots.map(d => d.name.split('/').pop()));
let slot = -1; for (let s = 0; s < cfg.lagStorrelse; s++) if (!taken.has(`t${lag}s${s}`)) { slot = s; break; }
if (slot < 0) { console.error('Laget er fullt.'); process.exit(1); }
const old = `t${cur.fields.team.integerValue}s${cur.fields.slot.integerValue}`;
const r = await fetch(`https://firestore.googleapis.com/v1/${ROOT}:commit`, { method: 'POST', headers: H, body: JSON.stringify({ writes: [
  { update: { name: cur.name, fields: { ...cur.fields, team: { integerValue: String(lag) }, slot: { integerValue: String(slot) } } } },
  { delete: `${ROOT}/slots/${old}` },
  { update: { name: `${ROOT}/slots/t${lag}s${slot}`, fields: { pid: { stringValue: pid }, team: { integerValue: String(lag) }, slot: { integerValue: String(slot) } } }, currentDocument: { exists: false } }
] }) });
if (!r.ok) { console.error(await r.text()); process.exit(1); }
console.log(`${pid} flyttet til ${cfg.lag.find(l => l.id === lag).navn} (plass ${slot + 1}).`);
