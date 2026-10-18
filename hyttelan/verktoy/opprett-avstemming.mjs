// Oppretter (eller oppdaterer) en avstemming i databasen ut fra data/lan.json.
// Bruk: node hyttelan/verktoy/opprett-avstemming.mjs v1
// Avstemmingen må først stå i "avstemminger" i lan.json (id, spiller, apner, stenger).
import { readFileSync } from 'node:fs';
import { write } from './firestore-admin.mjs';
const id = process.argv[2];
const cfg = JSON.parse(readFileSync(new URL('../data/lan.json', import.meta.url)));
const v = (cfg.avstemminger || []).find(x => x.id === id);
if (!v) { console.error(`Fant ikke ${id} i data/lan.json`); process.exit(1); }
await write('votes', id, { spiller: v.spiller, apner: Date.parse(v.apner), stenger: Date.parse(v.stenger) });
console.log(`Avstemming ${id} er åpen ${v.apner} – ${v.stenger}. Husk å pushe lan.json.`);
