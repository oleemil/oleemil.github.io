# HYTTELAN VI · Hovden · konkurranseplattform

Live: https://inmoment.no/hyttelan/ (GitHub Pages). Kun mappen `hyttelan/` hører til dette. Resten av inmoment.no er en annen nettside og skal ikke røres.

## Hva siden gjør

- **Hjem**: nedtelling til startskuddet torsdag 19. november kl. 20.00, status og crewet.
- **Velg dag** (fire steg): navn → torsdag (helt) eller fredag (loser) → vilkår → trekning med spilleautomat som viser laget ditt.
- **Lag**: poengtavle og lagoppstilling, oppdatert live.
- **Konkurranser**: leses fra `data/lan.json`.
- **Noob-sjekk**: fredagsfolk melder seg som noob én gang per reset (hver 3. time fra startskuddet til fredag kl. 20.00). Poeng: 1 innen 5 min, 0,5 innen 15 min, 0,1 resten av første time, ellers 0.
- **Regler**: konkurransereglene og vilkårene.
- **Losers**: de som ikke svarte på første invitasjon. De kan bli med frem til `tider.losersFrist`. Etterpå står de der som WASTED. Fredagsfolk vises også her.

## Filer

| Fil | Innhold |
| --- | --- |
| `index.html` | Siden. |
| `plattform.js` | All logikk (Firebase Firestore via gstatic CDN). |
| `plattform.css` | Stiler for plattformen. Bygger på `base.css` (opprinnelig design) og `live-style.css`. |
| `data/lan.json` | **Det du redigerer:** tider, lag, deltakere, poengskala, konkurranser, straffer og avstemminger. |
| `visning-data.json` | Profilene. Rekkefølgen gir ID: første person = `p01`, bilde `assets/portraits/player-01.webp`. |
| `firebase/firestore.rules` | Sikkerhetsregler. Tider og deltakerlister er hardkodet her og må stemme med `lan.json`. |
| `verktoy/` | Vertsverktøy: `status.mjs` (lagoversikt), `tell-stemmer.mjs` (opptelling). |

Gamle filer fra invitasjonen (`build-live.py`, `live-client.js`, `app.js`, `design-reference.html` m.fl.) er ikke i bruk lenger. `build-live.py` og workflowen `hyttelan-live.yml` må **ikke** kjøres, fordi de overskriver `index.html` med den gamle Supabase-invitasjonen.

## Backend

Firebase-prosjekt `hyttelan-hovden` (Firestore, eur3) på ole.emil.urstad@gmail.com. Ingen innlogging: påmeldingen er tillitsbasert, men reglene hindrer overskriving, dobbel lagplass, falske tidsstempler, noob-meldinger fra torsdagsfolk og mer enn én noob per reset.

Samlinger: `players/{pid}`, `slots/t{lag}s{plass}`, `noobs/{pid}_{vindu}`, `votes/{sak}` (opprettes av verten), `ballots/{sak}_{pid}` (ikke lesbar for noen andre enn eieren).

Testprosjekt: `hyttelan-hovden-test`. Åpne siden med `?test=1` for å bruke det. Tider kan overstyres i testmodus, f.eks. `?test=1&startskudd=2026-10-18T14:00:00%2B02:00`.

Deploy regler: `cd hyttelan/firebase && firebase deploy --only firestore:rules --project hyttelan-hovden`

## Oppskrift: legg til en konkurranse (med Claude)

Si f.eks.: *«Legg til konkurransen Heist-race torsdag kl. 21 på hyttelan»*. Claude legger et objekt i `konkurranser` i `data/lan.json`, committer og pusher:

```json
{
  "id": "k1",
  "navn": "Heist-race i Vice City",
  "spill": "GTA VI",
  "tidspunkt": "2026-11-19T21:00:00+01:00",
  "status": "kommer",
  "beskrivelse": "Lagene kjører samme heist. Raskeste lag vinner.",
  "regler": ["Alle på laget må være med i bilen", "Omstart = +30 sek"]
}
```

- `status`: `kommer` → `pagar` (vises med blinkende merke) → `ferdig`.
- **Resultat:** sett `"status": "ferdig"` og `"resultat": [2, 0, 3, 1]` (lag-ID i plasseringsrekkefølge). Det gir poeng fra `plasseringspoeng` (10, 7, 5, 3). Ved delt plass: `"resultat": [[2, 0], 3, 1]` gir begge lagene poengene for 1. plass, og neste lag blir nr. 3.
- Egen poengskala for én konkurranse: `"poeng": [20, 10, 5, 0]`, eller fritt per lag: `"poengPerLag": { "0": 3, "2": 8 }`.
- Lag-ID: 0 Vice Hovden Vipers, 1 Leonida Lemen, 2 Grand Theft Aurora, 3 Fjellvidda Flamingos. 4 lag à 5 plasser.

## Straff for jobbing (§5.3)

1. Legg til i `justeringer`: `{ "lag": 3, "poeng": -3, "grunn": "Svarte på jobbmail", "tidspunkt": "2026-11-20T14:12:00+01:00" }`
2. Legg til en avstemming i `avstemminger`. ID-en må være `v` + tall:
   `{ "id": "v1", "spiller": "p07", "sporsmal": "Skal Lars utestenges fra neste konkurranse?", "grunn": "Jobbmail", "apner": "2026-11-20T14:15:00+01:00", "stenger": "2026-11-20T15:00:00+01:00" }`
3. Åpne den i databasen: `node hyttelan/verktoy/opprett-avstemming.mjs v1` (stemmer avvises før `apner`, etter `stenger` og fra den anklagede).
4. Når den er stengt: `node hyttelan/verktoy/tell-stemmer.mjs v1`. Skriv summen inn som `"resultat": { "ja": 6, "nei": 4, "utfall": "Utestengt fra neste konkurranse" }`.

## Andre vertsoppgaver

- Se lagene: `node hyttelan/verktoy/status.mjs`
- Endre lag, tider eller deltakere: oppdater **både** `data/lan.json` og `firebase/firestore.rules`, og deploy reglene.
- Flytte en spiller til et annet lag: slett `players/{pid}` og `slots/...` i Firebase-konsollen. Da kan spilleren registrere seg på nytt.
- Flytte en spiller: `node hyttelan/verktoy/flytt.mjs p02 2` (spiller-ID, lag-ID).
