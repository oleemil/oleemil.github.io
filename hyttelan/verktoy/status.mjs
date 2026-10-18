// Viser påmeldinger, lag og noob-poeng fra databasen.
// Bruk: node hyttelan/verktoy/status.mjs
import { readFileSync } from 'node:fs';
import { list } from './firestore-admin.mjs';
const dir = new URL('..', import.meta.url);
const cfg = JSON.parse(readFileSync(new URL('data/lan.json', dir)));
const people = JSON.parse(readFileSync(new URL('visning-data.json', dir)));
const name = pid => people[Number(pid.slice(1)) - 1]?.name || pid;
const players = await list('players'), noobs = await list('noobs');
for (const l of cfg.lag) {
  const m = players.filter(p => p.team === l.id).sort((a, b) => a.slot - b.slot);
  console.log(`\n${l.navn} (${m.length}/${cfg.lagStorrelse})`);
  m.forEach(p => console.log(`  ${p.day === 'tor' ? 'TOR' : 'FRE'}  ${name(p.pid)}`));
}
const missing = [...cfg.deltakere.bekreftet, ...cfg.deltakere.losers].filter(id => !players.some(p => p.pid === id));
console.log('\nIkke valgt dag:', missing.map(name).join(', ') || 'ingen');
console.log('Noob-meldinger:', noobs.length);
