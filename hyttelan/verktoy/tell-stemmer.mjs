// Teller opp en anonym avstemming og skriver bare summen.
// Bruk: node hyttelan/verktoy/tell-stemmer.mjs v1
import { list } from './firestore-admin.mjs';
import { readFileSync } from 'node:fs';
const sak = process.argv[2];
if (!/^v\d+$/.test(sak || '')) { console.error('Bruk: node tell-stemmer.mjs v1'); process.exit(1); }
const cfg = JSON.parse(readFileSync(new URL('../data/lan.json', import.meta.url)));
const target = cfg.avstemminger?.find(v => v.id === sak)?.spiller;
const ballots = (await list('ballots')).filter(b => b.id.startsWith(sak + '_') && b.id !== `${sak}_${target}`);
const ja = ballots.filter(b => b.vote === 'ja').length, nei = ballots.length - ja;
console.log(JSON.stringify({ ja, nei, utfall: ja > nei ? 'Utestengt fra neste konkurranse' : 'Frikjent' }));
