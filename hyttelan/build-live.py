"""Compile only the approved Hyttelan files already in this repository.
No database requests, credentials lookup, or attendance writes occur at build time.
"""
import html,json
from pathlib import Path
from bs4 import BeautifulSoup
from share_preview import configure_share, DEADLINE, SHARE_URL
ROOT=Path(__file__).resolve().parent
people=json.loads((ROOT/'visning-data.json').read_text())
config=json.loads((ROOT/'backend-config.json').read_text())
assert len(people)==len(config['guestIds'])==19
assert len({p['name'] for p in people})==19
for i,p in enumerate(people):
 p.pop('crop',None)
 p.update(id=config['guestIds'][i],role='invite',status='pending',profileVisible=True,confirmedAt=None,
  photo=f'https://raw.githubusercontent.com/oleemil/oleemil.github.io/main/hyttelan/assets/portraits/player-{i+1:02}.webp')
config.pop('guestIds')
config['shareUrl']=SHARE_URL
config['bootstrap']={'ok':True,'serverTime':0,'eventDate':'2026-11-19','deadline':DEADLINE,'profileVisibility':'open','registrationOpen':True,'capacity':19,'guests':people}
soup=BeautifulSoup((ROOT/'design-reference.html').read_text(),'html.parser')
for tag in soup.find_all(['script','dialog']):tag.decompose()
for tag in soup.select('#popup-fallback'):tag.decompose()
grid=soup.find(id='crew-grid');grid.clear();grid['aria-busy']='true'
e=lambda x:html.escape(str(x or ''),quote=True)
for i,p in enumerate(people):
 card=f'''<article class="card profile-open" id="guest-{e(p['id'])}"><div class="portrait"><img src="{e(p['photo'])}" alt="GTA-inspirert illustrasjon merket {e(p['name'])}" width="255" height="205" loading="lazy"><span class="file">PLAYER / {i+1:02}</span><div class="badge">HENTER SVARSTATUS</div></div><div class="card-body"><h3>{e(p['name'])}</h3><span class="nickname">{e(p['nickname'])}</span><h4>DERFOR ELSKER JEG GTA 6</h4><p>{e(p['gta'])}</p><h4>DERFOR ER JEG HYTTEKLAR</h4><p>{e(p['cabin'])}</p><blockquote>«{e(p['quote'])}»</blockquote><small class="fiction">GTA-inspirert illustrasjon. Fiktiv LAN-rolle og vennskapelig gaminghumor.</small><button class="card-button" data-join="{e(p['id'])}">Dette er meg <span>↗</span></button></div></article>'''
 grid.append(BeautifulSoup(card,'html.parser'))
soup.select_one('.crew-header p').string='19 personer. Alle profiler er åpne. BEINKLAR betyr bekreftet påmelding.'
bar=soup.new_tag('div',id='profile-mode',attrs={'class':'profile-mode'});bar.string='ALLE PROFILER ER ÅPNE · STATUS OPPDATERES NÅR HVER PERSON SVARER';soup.find('header').insert_after(bar)
soup.select_one('.crew-tools').insert_before(BeautifulSoup('<div class="search-row"><label for="profile-search">Finn en deltaker<input id="profile-search" type="search" placeholder="Navn eller kallenavn" autocomplete="off"></label><span id="profile-count">19 / 19 PROFILER</span></div>','html.parser'))
soup.select_one('.trust')['id']='trust-note'
soup.select_one('.trust').string='Velg bare ditt eget navn. Påmeldingen er tillitsbasert. Profilene er åpne, men ingen blir automatisk påmeldt.'
soup.find(id='confirmed').string='··';soup.find(id='capacity').string='19'
soup.find(id='sync-status').string='Henter svar fra den felles deltakerlisten.';soup.find(id='sync-label').string='KOBLER TIL'
soup.title.string='HYTTELAN VI · Hovden · 19 deltakere'
modal='''<dialog id="rsvp-dialog" aria-labelledby="rsvp-title"><button class="modal-close" type="button" aria-label="Lukk påmeldingen">×</button><h2 id="rsvp-title">ER DU MED?</h2><p id="rsvp-intro"></p><form id="rsvp-form"><label class="rsvp-label" for="rsvp-name">Navnet ditt<select id="rsvp-name" required><option value="">Velg ditt eget navn</option></select></label><div class="rsvp-person"><strong id="rsvp-person">Spillermappen din</strong><span id="rsvp-hint"></span></div><label class="rsvp-consent"><input id="rsvp-consent" type="checkbox" required><span>Dette er mitt navn. Jeg bekrefter mitt eget svar og at statusen min vises for gjengen.</span></label><p id="rsvp-error" role="alert" hidden></p><button id="rsvp-submit" class="dialog-action" type="submit">Jeg er beinklar!</button><button id="rsvp-decline" type="button">Jeg kan ikke komme</button></form><div id="rsvp-result" hidden><p id="rsvp-result-text"></p><button id="rsvp-done" class="dialog-action" type="button">Tilbake til crewet</button></div><small id="rsvp-footnote"></small></dialog>'''
soup.body.append(BeautifulSoup(modal,'html.parser'))
style=soup.new_tag('style');style.string=(ROOT/'live-style.css').read_text();soup.head.append(style)
script=soup.new_tag('script');script.string='window.HYTTELAN_CONFIG='+json.dumps(config,ensure_ascii=False,separators=(',',':')).replace('<','\\u003c')+';\n'+(ROOT/'live-client.js').read_text();soup.body.append(script)
for tag in soup.find_all('noscript'):
 tag.clear();tag.append('Bildene og tekstene kan leses uten JavaScript. Slå på JavaScript for felles påmelding.')
configure_share(soup)
output=str(soup)
assert 'hovden-hyttelan-2026.higgsfield.app' not in output
assert 'window.open(' not in output
assert len(soup.select('.card.profile-open'))==19
for name in ['index.html','deltakere.html']:(ROOT/name).write_text(output)
print('Built 19 participant profiles and shared RSVP UI from local files. Attendance untouched.')
