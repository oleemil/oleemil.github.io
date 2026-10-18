/* Hyttelan VI · konkurranseplattform.
   Statisk oppsett (lag, tider, konkurranser) ligger i data/lan.json.
   Felles tilstand (påmeldinger, noob-sjekk, stemmer) ligger i Firestore,
   beskyttet av firebase/firestore.rules. Ingen innlogging; tillitsbasert. */
import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js';
import { getFirestore, collection, doc, onSnapshot, writeBatch, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';

const PROD = {
  apiKey: 'AIzaSyA1nduS3ZAgdyMvowAsnYpIY0-j5s22SQM',
  authDomain: 'hyttelan-hovden.firebaseapp.com',
  projectId: 'hyttelan-hovden',
  storageBucket: 'hyttelan-hovden.firebasestorage.app',
  messagingSenderId: '73960234722',
  appId: '1:73960234722:web:72764014cdc104b49688bb'
};
// ?test=1 bruker et eget testprosjekt, og tidene i lan.json kan overstyres
// med f.eks. ?test=1&startskudd=2026-10-18T14:00:00%2B02:00
const QS = new URLSearchParams(location.search), TEST = QS.has('test');
const FIREBASE = TEST ? {
  apiKey: 'AIzaSyCskjSkU6fadp_-2hOK564up_85xQZFe1E',
  authDomain: 'hyttelan-hovden-test.firebaseapp.com',
  projectId: 'hyttelan-hovden-test',
  appId: '1:192412070485:web:fcb4e020a5913a64271adc'
} : PROD;
const HOUR = 3600000, MIN = 60000;

const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (t, o) => new Intl.DateTimeFormat('nb-NO', { timeZone: 'Europe/Oslo', ...o }).format(new Date(t));
const fmtTime = t => fmt(t, { weekday: 'short', hour: '2-digit', minute: '2-digit' });
const fmtPts = n => (Math.round(n * 10) / 10).toLocaleString('nb-NO', { maximumFractionDigits: 1 });
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

let cfg, people = [], byId = new Map(), T = {};
let players = {}, noobs = [], live = false, clockOffset = 0, filter = 'all';
const now = () => Date.now() + clockOffset;

/* ---------- oppstart ---------- */
async function boot() {
  const [cfgRes, peopleRes] = await Promise.all([fetch('data/lan.json', { cache: 'no-cache' }), fetch('visning-data.json', { cache: 'no-cache' })]);
  const serverDate = Date.parse(cfgRes.headers.get('date') || '');
  if (Number.isFinite(serverDate) && Math.abs(serverDate - Date.now()) > 5000) clockOffset = serverDate - Date.now();
  cfg = await cfgRes.json();
  const raw = await peopleRes.json();
  for (const [k, v] of Object.entries(cfg.tider)) T[k] = typeof v === 'string' ? Date.parse(TEST && QS.get(k) || v) : v;
  if (TEST) document.body.classList.add('test-mode');
  T.intervall = cfg.tider.noobIntervallTimer * HOUR;
  const allowed = new Set([...cfg.deltakere.bekreftet, ...cfg.deltakere.losers]);
  people = raw.map((p, i) => ({
    id: 'p' + String(i + 1).padStart(2, '0'), n: i + 1, name: p.name, first: p.name.split(' ')[0],
    nickname: p.nickname, gta: p.gta, cabin: p.cabin, quote: p.quote,
    photo: 'assets/portraits/player-' + String(i + 1).padStart(2, '0') + '.webp'
  })).filter(p => allowed.has(p.id));
  people.forEach(p => byId.set(p.id, p));
  $('rule-points').textContent = cfg.plasseringspoeng.join(' · ');
  route(); renderAll(); tick(); setInterval(tick, 1000);
  connect();
}

function connect() {
  let db;
  try { db = getFirestore(initializeApp(FIREBASE)); } catch (e) { return offline(e); }
  window.__db = db;
  onSnapshot(collection(db, 'players'), snap => {
    players = {};
    snap.forEach(d => { const v = d.data({ serverTimestamps: 'estimate' }); players[d.id] = { ...v, at: v.createdAt?.toMillis?.() ?? now() }; });
    live = true; renderAll();
  }, offline);
  onSnapshot(collection(db, 'noobs'), snap => {
    noobs = [];
    snap.forEach(d => { const v = d.data({ serverTimestamps: 'estimate' }); noobs.push({ id: d.id, ...v, at: v.createdAt?.toMillis?.() ?? now() }); });
    renderAll();
  }, offline);
}
function offline(e) {
  console.error(e); live = false;
  $('status-bar').textContent = 'FÅR IKKE KONTAKT MED SERVEREN · PRØV Å LASTE SIDEN PÅ NYTT';
  $('status-bar').classList.add('error');
}

/* ---------- regler for lag og poeng ---------- */
const team = id => cfg.lag.find(l => l.id === id);
const isConfirmed = id => cfg.deltakere.bekreftet.includes(id);
const isLoser = id => cfg.deltakere.losers.includes(id);
const canJoin = id => !players[id] && (isConfirmed(id) ? now() < T.registreringStenger : isLoser(id) && now() <= T.losersFrist);
const members = t => Object.values(players).filter(p => p.team === t).sort((a, b) => a.slot - b.slot);

// Torsdag: fyll lag 1 helt, så lag 2 ... Fredag: fyll ledige plasser bakfra.
function pickSlot(day) {
  const taken = new Set(Object.values(players).map(p => p.team + ':' + p.slot));
  const ids = cfg.lag.map(l => l.id);
  const order = day === 'tor' ? ids : [...ids].reverse();
  for (const t of order) for (let s = 0; s < cfg.lagStorrelse; s++) if (!taken.has(t + ':' + s)) return { team: t, slot: s };
  return null;
}

function noobPoints(n) {
  const start = T.startskudd + n.w * T.intervall, d = n.at - start;
  if (d < 0) return 0;
  if (d <= 5 * MIN) return 1;
  if (d <= 15 * MIN) return 0.5;
  if (d <= HOUR) return 0.1;
  return 0;
}

function compPoints(c) {
  const out = {};
  if (c.status !== 'ferdig') return out;
  if (c.poengPerLag) for (const [t, v] of Object.entries(c.poengPerLag)) out[t] = Number(v) || 0;
  else {
    let place = 0; // delt plassering: [[0,2],1,...] gir 1.,1.,3. plass
    for (const t of c.resultat || []) {
      const group = Array.isArray(t) ? t : [t];
      group.forEach(x => out[x] = (c.poeng || cfg.plasseringspoeng)[place] ?? 0);
      place += group.length;
    }
  }
  return out;
}

function standings() {
  const rows = cfg.lag.map(l => ({ ...l, comp: 0, noob: 0, adj: 0, total: 0 }));
  const row = id => rows.find(r => r.id === Number(id));
  for (const c of cfg.konkurranser) for (const [t, v] of Object.entries(compPoints(c))) row(t) && (row(t).comp += v);
  for (const n of noobs) { const p = players[n.pid]; if (p && row(p.team)) row(p.team).noob += noobPoints(n); }
  for (const j of cfg.justeringer) row(j.lag) && (row(j.lag).adj += Number(j.poeng) || 0);
  rows.forEach(r => r.total = Math.round((r.comp + r.noob + r.adj) * 10) / 10);
  return rows.sort((a, b) => b.total - a.total || a.id - b.id);
}

/* ---------- visninger ---------- */
function route() {
  let h = location.hash.slice(1) || 'hjem';
  if (h === 'crew') h = 'hjem';
  if (h === 'innhold') return $('innhold').focus();
  if (!document.querySelector(`.view[data-view="${h}"]`)) h = 'hjem';
  document.querySelectorAll('.view[data-view]').forEach(v => v.hidden = v.dataset.view !== h);
  document.querySelectorAll('[data-route]').forEach(a => a.dataset.route === h ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current'));
  document.querySelector('.tabbar [aria-current]')?.scrollIntoView({ block: 'nearest', inline: 'center' });
  document.body.dataset.route = h;
  if (location.hash === '#crew') $('crew')?.scrollIntoView(); else scrollTo(0, 0);
}
addEventListener('hashchange', route);

function renderAll() {
  if (!cfg) return;
  renderStats(); renderCrew(); renderTeams(); renderComps(); renderNoob(); renderLosers(); renderVotes();
}

function renderStats() {
  const reg = Object.values(players), thu = reg.filter(p => p.day === 'tor').length, fri = reg.filter(p => p.day === 'fre').length;
  const expected = people.filter(p => isConfirmed(p.id) || players[p.id]).length;
  $('stat-registered').textContent = live ? reg.length : '··';
  $('stat-total').textContent = expected;
  $('stat-thursday').textContent = live ? thu : '··';
  $('stat-friday').textContent = live ? fri : '··';
  const top = standings()[0];
  $('stat-leader').textContent = live ? (top.total > 0 ? top.kort : 'INGEN ENNÅ') : '··';
  if (live) {
    $('status-bar').classList.remove('error');
    $('status-bar').textContent = `LIVE · ${reg.length} AV ${expected} HAR VALGT DAG · ${thu} KOMMER TORSDAG · ${fri} KOMMER FREDAG`;
  }
}

function dayBadge(p) {
  const r = players[p.id];
  if (!r) return '<div class="badge">IKKE VALGT DAG ENNÅ</div>';
  return r.day === 'tor' ? '<div class="badge day-tor">TORSDAG · HELT</div>' : '<div class="badge day-fre">FREDAG · LOSER</div>';
}
function teamChip(p) {
  const r = players[p.id]; if (!r) return '';
  const l = team(r.team);
  return `<a class="team-chip" href="#lag" style="--team:${l.farge}"><i>${esc(l.kort)}</i>${esc(l.navn)}</a>`;
}

function renderCrew() {
  const list = people.filter(p => isConfirmed(p.id) || players[p.id]);
  const shown = list.filter(p => filter === 'all' || (filter === 'none' ? !players[p.id] : players[p.id]?.day === filter));
  $('crew-count').textContent = shown.length + ' / ' + list.length;
  $('crew-sub').textContent = `${list.length} spillere er med. Velg dag for å bli trukket til et lag.`;
  $('crew-grid').setAttribute('aria-busy', String(!live));
  $('crew-grid').innerHTML = shown.length ? shown.map(p => {
    const r = players[p.id];
    return `<article class="card profile-open ${r ? 'ready ' + (r.day === 'tor' ? 'is-tor' : 'is-fre') : ''}" id="guest-${p.id}">
      <div class="portrait"><img src="${p.photo}" alt="GTA-inspirert illustrasjon av ${esc(p.name)}" width="255" height="205" loading="lazy"><span class="file">PLAYER / ${String(p.n).padStart(2, '0')}</span>${live ? dayBadge(p) : '<div class="badge">HENTER STATUS</div>'}</div>
      <div class="card-body"><h3>${esc(p.name)}</h3><span class="nickname">${esc(p.nickname)}</span>${teamChip(p)}
      <h4>DERFOR ELSKER JEG GTA 6</h4><p>${esc(p.gta)}</p><h4>DERFOR ER JEG HYTTEKLAR</h4><p>${esc(p.cabin)}</p><blockquote>«${esc(p.quote)}»</blockquote>
      ${live && canJoin(p.id) ? `<button class="card-button" data-join="${p.id}">Dette er meg · velg dag <span>↗</span></button>` : ''}</div></article>`;
  }).join('') : '<div class="empty-state"><h3>INGEN HER ENNÅ.</h3><p>Prøv et annet filter.</p></div>';
}

function renderTeams() {
  const rows = standings(), max = Math.max(1, ...rows.map(r => r.total));
  $('leaderboard').innerHTML = rows.map((r, i) => `<li style="--team:${r.farge}">
    <span class="lb-rank">${i + 1}</span><span class="lb-logo">${esc(r.kort)}</span>
    <div class="lb-main"><b>${esc(r.navn)}</b><div class="lb-bar"><span style="width:${Math.max(0, r.total) / max * 100}%"></span></div>
    <small>Konkurranser ${fmtPts(r.comp)} · Noob ${fmtPts(r.noob)}${r.adj ? ' · Straff/justering ' + fmtPts(r.adj) : ''}</small></div>
    <span class="lb-total">${fmtPts(r.total)}<small>POENG</small></span></li>`).join('');
  $('teams').innerHTML = cfg.lag.map(l => {
    const m = members(l.id), slots = [];
    for (let s = 0; s < cfg.lagStorrelse; s++) {
      const r = m.find(x => x.slot === s), p = r && byId.get(r.pid);
      slots.push(p ? `<li class="${r.day === 'fre' ? 'fre' : 'tor'}"><img src="${p.photo}" alt="" width="48" height="48" loading="lazy"><span><b>${esc(p.name)}</b><small>${r.day === 'tor' ? 'TORSDAG · HELT' : 'FREDAG · LOSER'}</small></span></li>`
        : '<li class="open"><span class="open-slot">?</span><span><b>LEDIG PLASS</b><small>VENTER PÅ TREKNING</small></span></li>');
    }
    const thu = m.filter(x => x.day === 'tor').length;
    return `<article class="team-card" id="team-${l.id}" style="--team:${l.farge}"><header><span class="team-logo">${esc(l.kort)}</span><div><h3>${esc(l.navn)}</h3><p>${esc(l.slagord)}</p></div></header>
      <ul class="team-members">${slots.join('')}</ul><footer>${thu} PÅ PLASS TORSDAG · ${m.length}/${cfg.lagStorrelse} TOTALT</footer></article>`;
  }).join('');
}

function renderComps() {
  const list = [...cfg.konkurranser].sort((a, b) => Date.parse(a.tidspunkt || 0) - Date.parse(b.tidspunkt || 0));
  const statusLabel = { kommer: 'KOMMER', pagar: 'PÅGÅR NÅ', ferdig: 'FERDIG' };
  $('comp-list').innerHTML = list.length ? list.map((c, i) => {
    const pts = compPoints(c), res = Object.entries(pts).sort((a, b) => b[1] - a[1]);
    return `<article class="comp ${esc(c.status)}"><span class="comp-no">#${String(i + 1).padStart(2, '0')}</span>
      <div class="comp-main"><p class="comp-meta"><span class="comp-status">${statusLabel[c.status] || esc(c.status)}</span>${c.tidspunkt ? esc(fmt(Date.parse(c.tidspunkt), { weekday: 'long', hour: '2-digit', minute: '2-digit' })) : 'TIDSPUNKT KOMMER'}${c.spill ? ' · ' + esc(c.spill) : ''}</p>
      <h3>${esc(c.navn)}</h3><p>${esc(c.beskrivelse || '')}</p>
      ${c.regler?.length ? `<ul>${c.regler.map(r => `<li>${esc(r)}</li>`).join('')}</ul>` : ''}
      ${res.length ? `<ol class="comp-result">${res.map(([t, v]) => `<li style="--team:${team(Number(t))?.farge}"><b>${esc(team(Number(t))?.navn)}</b><span>+${fmtPts(v)}</span></li>`).join('')}</ol>` : ''}</div></article>`;
  }).join('') : `<div class="comp-empty"><span class="comp-lock">?</span><h3>OPPDRAGENE ER HEMMELIGE.</h3><p>Det første oppdraget avsløres før startskuddet torsdag kl. 20.00. Hold GTA oppdatert og fingrene varme.</p></div>`;
}

function noobWindow(t = now()) {
  if (t < T.startskudd || t >= T.noobSlutt) return null;
  const w = Math.floor((t - T.startskudd) / T.intervall);
  return { w, start: T.startskudd + w * T.intervall, next: Math.min(T.startskudd + (w + 1) * T.intervall, T.noobSlutt) };
}

function renderNoob() {
  const fri = people.filter(p => players[p.id]?.day === 'fre');
  const sel = $('noob-name'), prev = sel.value;
  sel.replaceChildren(new Option(fri.length ? 'Velg navnet ditt' : 'Ingen fredagsfolk ennå', ''), ...fri.map(p => new Option(p.name + ' · ' + team(players[p.id].team).navn, p.id)));
  sel.value = fri.some(p => p.id === prev) ? prev : '';
  const feed = [...noobs].sort((a, b) => b.at - a.at);
  $('noob-feed').innerHTML = feed.length ? feed.map(n => {
    const p = byId.get(n.pid), r = players[n.pid], l = r && team(r.team), pts = noobPoints(n);
    return `<li style="--team:${l?.farge || '#888'}"><img src="${p?.photo || ''}" alt="" width="40" height="40" loading="lazy"><div><b>${esc(p?.name || n.pid)}</b><small>${esc(l?.navn || '')} · reset #${n.w + 1} · ${fmtTime(n.at)}</small><p>«${esc(n.text)}»</p></div><span class="noob-pts ${pts >= 1 ? 'gold' : pts >= .5 ? 'silver' : pts > 0 ? 'bronze' : ''}">+${fmtPts(pts)}</span></li>`;
  }).join('') : '<li class="noob-empty">Ingen noober har meldt seg ennå. Første reset er ved startskuddet torsdag kl. 20.00.</li>';
}

function renderLosers() {
  const unanswered = people.filter(p => isLoser(p.id) && !players[p.id]);
  const open = now() <= T.losersFrist;
  $('loser-grid').innerHTML = unanswered.length ? unanswered.map(p => `<article class="loser-card ${open ? '' : 'wasted'}">
      <div class="loser-photo"><img src="${p.photo}" alt="GTA-inspirert illustrasjon av ${esc(p.name)}" loading="lazy"><span class="loser-stamp">${open ? 'IKKE SVART' : 'WASTED'}</span></div>
      <h3>${esc(p.name)}</h3><span class="nickname">${esc(p.nickname)}</span>
      ${open ? `<button class="card-button" data-join="${p.id}">Bli med likevel <span>↗</span></button>` : '<p class="loser-note">Fristen er ute.</p>'}</article>`).join('')
    : '<div class="empty-state"><h3>INGEN SOFALOSERS IGJEN.</h3><p>Alle som fikk sjansen, har svart. Respekt.</p></div>';
  const fri = people.filter(p => players[p.id]?.day === 'fre');
  $('friday-grid').innerHTML = fri.length ? fri.map(p => `<article class="loser-card fre"><div class="loser-photo"><img src="${p.photo}" alt="" loading="lazy"><span class="loser-stamp">FREDAG</span></div><h3>${esc(p.name)}</h3><span class="nickname">Erkjent loser · ${esc(team(players[p.id].team).navn)}</span></article>`).join('')
    : '<p class="muted">Ingen har innrømmet at de kommer fredag. Ennå.</p>';
  $('losers-lead').innerHTML = open
    ? `Disse har ikke svart. De kan fortsatt bli med frem til <b>${esc(fmt(T.losersFrist, { weekday: 'long', hour: '2-digit', minute: '2-digit' }))}</b>. Etter det er de offisielt WASTED.`
    : 'Fristen er ute. Disse svarte aldri, og her blir de stående.';
}

function renderVotes() {
  const list = cfg.avstemminger || [];
  $('votes').hidden = !list.length;
  $('vote-list').innerHTML = list.map(v => {
    const p = byId.get(v.spiller), open = now() >= Date.parse(v.apner) && now() < Date.parse(v.stenger) && !v.resultat;
    return `<article class="vote-card"><h4>${esc(v.sporsmal)}</h4><p>${p ? esc(p.name) : ''}${v.grunn ? ' · ' + esc(v.grunn) : ''}</p>
      ${v.resultat ? `<p class="vote-result">JA ${v.resultat.ja} · NEI ${v.resultat.nei} → <b>${esc(v.resultat.utfall)}</b></p>` : open ? `<button class="card-button" data-vote-open="${esc(v.id)}">Stem anonymt <span>↗</span></button><small>Stenger ${esc(fmtTime(Date.parse(v.stenger)))}</small>` : `<small>Åpner ${esc(fmtTime(Date.parse(v.apner)))}</small>`}</article>`;
  }).join('');
}

/* ---------- nedtellinger ---------- */
function setTimer(el, ms, units) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const v = { d: Math.floor(s / 86400), h: units.includes('d') ? Math.floor(s / 3600) % 24 : Math.floor(s / 3600), m: Math.floor(s / 60) % 60, s: s % 60 };
  el.querySelectorAll('[data-unit]').forEach(b => b.textContent = String(v[b.dataset.unit]).padStart(2, '0'));
}
let lastPhase = '';
function tick() {
  if (!cfg) return;
  const t = now();
  document.querySelectorAll('[data-countdown]').forEach(el => {
    const kind = el.dataset.countdown;
    if (kind === 'startskudd') setTimer(el, T.startskudd - t, 'dhms');
    if (kind === 'losers') setTimer(el, T.losersFrist - t, 'hms');
    if (kind === 'noob') { const w = noobWindow(t); setTimer(el, w ? w.next - t : T.startskudd - t, 'hms'); }
  });
  const w = noobWindow(t);
  $('noob-clock-label').textContent = t < T.startskudd ? 'FØRSTE RESET OM' : !w ? 'NOOB-SJEKKEN ER OVER' : w.next >= T.noobSlutt ? 'NOOB-SJEKKEN STENGER OM' : `RESET #${w.w + 2} OM`;
  const elapsed = w ? t - w.start : -1;
  $('noob-needle').style.left = w ? Math.min(100, elapsed / T.intervall * 100) + '%' : '0%';
  $('noob-now').innerHTML = !w ? (t < T.startskudd ? 'Noob-sjekken åpner ved startskuddet torsdag kl. 20.00.' : 'Vinduet er stengt. Takk for innsatsen, noober.')
    : `Reset #${w.w + 1} startet ${fmtTime(w.start)}. Melder du deg nå, får laget ditt <b>${fmtPts(noobPoints({ w: w.w, at: t }))} poeng</b>.`;
  $('noob-submit').disabled = !w || !live;
  document.body.classList.toggle('losers-expired', t > T.losersFrist);
  const votes = (cfg.avstemminger || []).map(v => (t >= Date.parse(v.apner)) + (t >= Date.parse(v.stenger)));
  const phase = [t > T.losersFrist, t >= T.startskudd, w?.w, t >= T.registreringStenger, ...votes].join();
  if (phase !== lastPhase) { if (lastPhase) renderAll(); lastPhase = phase; }
}

/* ---------- påmelding ---------- */
const dlg = $('join');
let pick = { pid: '', day: '' }, busy = false;
function step(n) {
  dlg.querySelectorAll('.join-step').forEach(s => s.hidden = s.dataset.step !== String(n));
  dlg.querySelectorAll('.join-progress span').forEach((s, i) => s.classList.toggle('on', i < n));
  dlg.dataset.step = n;
  const h = dlg.querySelector(`.join-step[data-step="${n}"] h2`);
  if (h) { h.tabIndex = -1; requestAnimationFrame(() => h.focus({ preventScroll: true })); }
}
function openJoin(pid = '') {
  if (!live) return toast('Venter på kontakt med serveren. Prøv igjen om et øyeblikk.');
  pick = { pid: '', day: '' };
  $('join-error').hidden = true; $('terms-form').reset();
  const eligible = people.filter(p => isConfirmed(p.id) || isLoser(p.id));
  $('name-grid').innerHTML = eligible.map(p => {
    const ok = canJoin(p.id), r = players[p.id];
    return `<button type="button" class="name-btn ${isLoser(p.id) ? 'is-loser' : ''}" data-pick="${p.id}" ${ok ? '' : 'disabled'}><img src="${p.photo}" alt="" width="44" height="44" loading="lazy"><span><b>${esc(p.name)}</b><small>${r ? 'Allerede trukket · ' + esc(team(r.team).navn) : isLoser(p.id) ? (ok ? 'Fra Losers-lista · siste sjanse' : 'Fristen er ute') : 'Bekreftet deltaker'}</small></span></button>`;
  }).join('');
  if (!dlg.open) dlg.showModal();
  if (pid && canJoin(pid)) choosePerson(pid); else step(1);
}
function choosePerson(pid) {
  pick.pid = pid;
  const p = byId.get(pid);
  $('day-intro').textContent = `Hei, ${p.first}. Er du en helt eller en loser?`;
  step(2);
}
function chooseDay(day) {
  pick.day = day;
  const fri = day === 'fre', box = $('loser-check');
  $('loser-term').classList.toggle('required', fri);
  $('loser-term').classList.toggle('exempt', !fri);
  box.required = fri; box.disabled = !fri; box.checked = false;
  $('loser-note').textContent = fri
    ? 'Du må krysse av. Du burde gå inn i deg selv og jobbe for å komme torsdag.'
    : 'Du trenger ikke krysse av. Du er en helt som kommer torsdag.';
  $('join-submit').textContent = fri ? 'Jeg innrømmer det. Trekk lag.' : 'Start trekningen';
  step(3);
}

async function register(e) {
  e.preventDefault();
  if (busy || !$('terms-form').reportValidity()) return;
  busy = true; $('join-submit').disabled = true; $('join-error').hidden = true;
  const { pid, day } = pick;
  let placed = null, err = null;
  for (let attempt = 0; attempt < 5 && !placed; attempt++) {
    if (players[pid]) { err = 'Navnet er allerede trukket til et lag.'; break; }
    const s = pickSlot(day);
    if (!s) { err = 'Alle lagplassene er fulle. Si fra til verten.'; break; }
    const b = writeBatch(window.__db);
    b.set(doc(window.__db, 'players', pid), { pid, day, team: s.team, slot: s.slot, terms: true, loser: day === 'fre', createdAt: serverTimestamp() });
    b.set(doc(window.__db, 'slots', `t${s.team}s${s.slot}`), { pid, team: s.team, slot: s.slot });
    try { await b.commit(); placed = s; }
    catch (x) {
      console.warn(x);
      err = x.code === 'permission-denied' ? 'Plassen ble tatt samtidig, eller fristen er ute. Prøver igjen …' : 'Nettverksfeil. Prøv igjen.';
      if (x.code !== 'permission-denied') break;
      await new Promise(r => setTimeout(r, 600 + attempt * 400));
    }
  }
  busy = false; $('join-submit').disabled = false;
  if (!placed) { $('join-error').textContent = err && !err.endsWith('…') ? err : 'Fikk ikke plass. Sjekk at fristen ikke er ute, og prøv igjen.'; $('join-error').hidden = false; return; }
  draw(placed.team, day);
}

function draw(teamId, day) {
  step(4);
  const reel = $('slot-reel'), L = cfg.lag, loops = 6;
  const seq = []; for (let i = 0; i < loops; i++) seq.push(...L);
  const targetIndex = (loops - 1) * L.length + L.findIndex(l => l.id === teamId);
  reel.innerHTML = seq.map(l => `<div class="slot-item" style="--team:${l.farge}"><span>${esc(l.kort)}</span><b>${esc(l.navn)}</b></div>`).join('');
  reel.style.transition = 'none'; reel.style.transform = 'translateY(0)';
  $('draw-result').hidden = true; $('draw-done').hidden = true; $('draw-live').textContent = '';
  $('draw-title').textContent = 'TREKKER LAG …';
  dlg.querySelector('.slot-machine').classList.add('spinning');
  const itemH = 86;
  requestAnimationFrame(() => requestAnimationFrame(() => {
    reel.style.transition = reduced ? 'none' : 'transform 4.2s cubic-bezier(.12,.72,.12,1)';
    reel.style.transform = `translateY(${-targetIndex * itemH}px)`;
  }));
  setTimeout(() => {
    dlg.querySelector('.slot-machine').classList.remove('spinning');
    const l = team(teamId), mates = members(teamId).filter(m => m.pid !== pick.pid).map(m => byId.get(m.pid)?.first).filter(Boolean);
    $('draw-title').textContent = day === 'tor' ? 'MISSION PASSED.' : 'LOSER REGISTRERT.';
    $('draw-result').style.setProperty('--team', l.farge);
    $('draw-result').innerHTML = `<span class="team-logo big">${esc(l.kort)}</span><h3>${esc(l.navn)}</h3><p class="slogan">${esc(l.slagord)}</p>
      <p>${mates.length ? 'Lagkamerater så langt: <b>' + mates.map(esc).join(', ') + '</b>.' : 'Du er først på laget. Resten trekkes etter hvert.'}</p>
      <p class="muted">${day === 'tor' ? 'Vi ses på Hovden torsdag. Startskuddet går kl. 20.00.' : 'Husk noob-sjekken hver tredje time fra torsdag kl. 20.00. Laget ditt trenger poengene.'}</p>`;
    $('draw-result').hidden = false; $('draw-done').hidden = false;
    $('draw-live').textContent = `Trekningen er ferdig. Du er på laget ${l.navn}.`;
    burst(l.farge);
  }, reduced ? 300 : 4400);
}

function burst(color) {
  if (reduced) return;
  const box = dlg.querySelector('.slot-machine');
  for (let i = 0; i < 26; i++) {
    const s = document.createElement('i'); s.className = 'spark';
    s.style.cssText = `--x:${(Math.random() - .5) * 360}px;--y:${-Math.random() * 220 - 30}px;--c:${i % 3 ? color : '#fff'};--r:${Math.random() * 360}deg`;
    box.appendChild(s); setTimeout(() => s.remove(), 1300);
  }
}

/* ---------- noob-sjekk ---------- */
$('noob-form').addEventListener('submit', async e => {
  e.preventDefault();
  const pid = $('noob-name').value, text = $('noob-text').value.trim(), w = noobWindow();
  const show = m => { $('noob-error').textContent = m; $('noob-error').hidden = !m; };
  if (!pid) return show('Velg navnet ditt.');
  if (!/noob/i.test(text)) return show('Meldingen må inneholde ordet «noob». Du vet hvorfor.');
  if (!w) return show('Noob-sjekken er ikke åpen akkurat nå.');
  if (noobs.some(n => n.pid === pid && n.w === w.w)) return show('Du har allerede meldt deg som noob denne runden. Vent til neste reset.');
  show(''); $('noob-submit').disabled = true;
  const tryW = [w.w, w.w + 1, w.w - 1].filter(x => x >= 0);
  let ok = false;
  for (const x of tryW) {
    try { await setDoc(doc(window.__db, 'noobs', `${pid}_${x}`), { pid, w: x, text, createdAt: serverTimestamp() }); ok = true; break; }
    catch (err) { if (err.code !== 'permission-denied') break; }
  }
  $('noob-submit').disabled = false;
  if (!ok) return show('Det gikk ikke. Enten har du allerede meldt deg denne runden, eller så er vinduet stengt.');
  $('noob-text').value = ''; toast('Noob registrert. Laget ditt takker deg.');
});

/* ---------- avstemming ---------- */
const vdlg = $('vote-dialog'); let voteId = '';
function openVote(id) {
  const v = cfg.avstemminger.find(x => x.id === id); if (!v) return;
  voteId = id; $('vote-question').textContent = v.sporsmal; $('vote-error').hidden = true;
  const voters = people.filter(p => players[p.id] && p.id !== v.spiller);
  $('vote-name').replaceChildren(new Option('Velg navnet ditt', ''), ...voters.map(p => new Option(p.name, p.id)));
  vdlg.showModal();
}
vdlg.addEventListener('click', async e => {
  const b = e.target.closest('[data-vote]'); if (!b) return;
  const pid = $('vote-name').value, err = m => { $('vote-error').textContent = m; $('vote-error').hidden = false; };
  if (!pid) return err('Velg navnet ditt først.');
  try { await setDoc(doc(window.__db, 'ballots', `${voteId}_${pid}`), { vote: b.dataset.vote }); vdlg.close(); toast('Stemmen er levert anonymt.'); }
  catch (x) { err(x.code === 'permission-denied' ? 'Stemmen ble ikke tatt imot. Enten har du stemt allerede, eller så er avstemmingen stengt.' : 'Nettverksfeil. Prøv igjen.'); }
});

/* ---------- felles ---------- */
let toastTimer;
function toast(s) { clearTimeout(toastTimer); $('toast').textContent = s; $('toast').hidden = false; toastTimer = setTimeout(() => $('toast').hidden = true, 5000); }
async function share() {
  const url = 'https://inmoment.no/hyttelan/';
  try { if (navigator.share) await navigator.share({ title: 'HYTTELAN VI · Hovden', text: 'Velg dag. Trekk lag. Torsdag er for helter.', url }); else { await navigator.clipboard.writeText(url); toast('Lenken er kopiert.'); } }
  catch (e) { if (e.name !== 'AbortError') toast('Del adressen: ' + url); }
}
document.addEventListener('click', e => {
  const t = e.target instanceof Element ? e.target : null; if (!t) return;
  const j = t.closest('[data-join]'); if (j) return openJoin(j.dataset.join || '');
  const p = t.closest('[data-pick]'); if (p && !p.disabled) return choosePerson(p.dataset.pick);
  const d = t.closest('[data-day]'); if (d) return chooseDay(d.dataset.day);
  const f = t.closest('[data-filter]');
  if (f) { filter = f.dataset.filter; document.querySelectorAll('[data-filter]').forEach(b => b.setAttribute('aria-pressed', String(b === f))); return renderCrew(); }
  const v = t.closest('[data-vote-open]'); if (v) return openVote(v.dataset.voteOpen);
  if (t.closest('[data-share]')) return void share();
  if (t.closest('.modal-close')) { if (busy && t.closest('#join')) return toast('Vent litt, plassen lagres …'); return t.closest('dialog').close(); }
});
$('terms-form').addEventListener('submit', register);
$('draw-done').addEventListener('click', () => { dlg.close(); location.hash = '#lag'; });
dlg.addEventListener('cancel', e => { if (busy) e.preventDefault(); });
dlg.addEventListener('close', () => renderAll());

boot().catch(offline);
