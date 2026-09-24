"""Render all invited profiles into actual HTML. JavaScript is optional, not a prerequisite."""
import base64, html, io, json, os, re, urllib.request
from pathlib import Path
from bs4 import BeautifulSoup
from PIL import Image
ROOT = Path(__file__).resolve().parent
people = json.loads((ROOT / 'visning-data.json').read_text())
assert len(people) == 19 and len({p['name'] for p in people}) == 19
source = ROOT / 'design-reference.html'
if not source.exists():
    source.write_text((ROOT / 'index.html').read_text())
soup = BeautifulSoup(source.read_text(), 'html.parser')
for tag in soup.find_all('script'):
    tag.decompose()
for tag in soup.find_all('dialog'):
    tag.decompose()
for tag in soup.find_all('noscript'):
    tag.decompose()
# Images are the labelled thumbnails supplied by the organizer, not inferred identities.
urls = [
 'https://d2ol7oe51mr4n9.cloudfront.net/user_3HZt7St0yOG76jhjpz8tmyp0PrP/602220c6-5ce0-41e3-8671-b8471215f8fa.png',
 'https://d2ol7oe51mr4n9.cloudfront.net/user_3HZt7St0yOG76jhjpz8tmyp0PrP/28259579-2745-4a37-bdfd-60b59cdb643f.png'
]
shots = []
for i,url in enumerate(urls):
    local = os.environ.get('HYTTELAN_INPUTS')
    if local:
        raw = (Path(local) / ('IMG_0033.png' if i == 0 else 'IMG_0034.png')).read_bytes()
    else:
        with urllib.request.urlopen(url, timeout=35) as r:
            raw = r.read(12_000_001)
        assert len(raw) <= 12_000_000
    im = Image.open(io.BytesIO(raw)).convert('RGB')
    assert im.size == (1206,2622), 'Unexpected source dimensions; never silently recrop'
    shots.append(im)
def uri(raw, mime):
    return 'data:' + mime + ';base64,' + base64.b64encode(raw).decode('ascii')
# Embed the approved artwork as well, so the downloaded file is fully self-contained.
hero = ROOT / 'assets/cabin-vice-city.webp'
original = ROOT / 'assets/cabin-original.webp'
for node in soup.find_all('img'):
    if 'cabin-vice-city.webp' in node.get('src',''):
        node['src'] = uri(hero.read_bytes(),'image/webp')
    elif 'cabin-original.webp' in node.get('src',''):
        node['src'] = uri(original.read_bytes(),'image/webp')
    node['loading'] = 'eager'
    node.attrs.pop('fetchpriority',None)
# Research matches are not asserted as facts here; character text remains labelled fiction.
cards = []
for i,p in enumerate(people):
    e = lambda key: html.escape(p[key], quote=True)
    photo = '<span class="profile-initials" aria-label="Personbilde mangler i medlemslisten">JO</span>'
    if p['crop'] is not None:
        j,x1,y1,x2,y2 = p['crop']
        cropped = shots[j].crop((x1,y1,x2,y2))
        buf = io.BytesIO(); cropped.save(buf,'JPEG',quality=92)
        photo = '<img class="profile-photo" width="120" height="120" src="'+uri(buf.getvalue(),'image/jpeg')+'" alt="Profilbilde fra medlemslisten ved navnet '+e('name')+'">'
    else:
        photo += '<small class="no-photo-note">INGEN PERSONFOTO I LISTEN</small>'
    cards.append('<article class="card profile-open" id="person-'+str(i+1)+'" data-search="'+html.escape((p['name']+' '+p['nickname']).lower(),quote=True)+'"><div class="profile-head"><span class="file">PLAYER / '+str(i+1).zfill(2)+'</span>'+photo+'<span class="profile-badge">PROFIL ÅPEN · IKKE BEKREFTET</span></div><div class="card-body"><h3>'+e('name')+'</h3><span class="nickname">'+e('nickname')+'</span><h4>DERFOR ELSKER JEG GTA 6</h4><p>'+e('gta')+'</p><h4>DERFOR ER JEG HYTTEKLAR</h4><p>'+e('cabin')+'</p><blockquote>«'+e('quote')+'»</blockquote><small class="fiction">Oppdiktet gaminghumor. Bildet og navnet er fra deltakerlisten.</small></div></article>')
grid = soup.find(id='crew-grid'); assert grid is not None
grid.clear(); grid['aria-busy']='false'
for card in cards:
    grid.append(BeautifulSoup(card,'html.parser'))
heading = soup.select_one('.crew-header p')
heading.string = '19 personer. Alle profiler er åpne. Ingen er forhåndspåmeldt.'
bar = soup.new_tag('div', attrs={'class':'static-review-bar'})
bar.string = 'ÅPEN PROFILVISNING · ALLE 19 ER SYNLIGE · PÅMELDING IKKE ÅPNET'
soup.find('header').insert_after(bar)
for button in soup.select('[data-join]'):
    button.name='a';button['href']='#pamelding';button.attrs.pop('data-join',None)
tools=soup.select_one('.crew-tools');tools.clear()
search=BeautifulSoup('<div class="profile-search"><label for="profile-search">Finn en deltaker</label><input id="profile-search" type="search" placeholder="Navn eller kallenavn"></div><strong class="profile-counter"><span id="profile-count">19</span> / 19 PROFILER</strong>','html.parser')
tools.append(search)
soup.find(id='sync-status').string='Alle 19 profiler og 18 profilbilder er innebygd i denne siden. JO Jenssen vises med initialer fordi medlemslisten mangler personfoto.'
soup.select_one('.trust').string='Åpen profil er ikke en påmelding. Profilene skal ikke låses før arrangøren gir beskjed.'
fallback=soup.find(id='popup-fallback')
if fallback:fallback.decompose()
soup.find(id='confirmed').string='0';soup.find(id='capacity').string='19'
soup.find(id='deadline-text').string='PLANLAGT SVARFRIST: FREDAG 25. SEPTEMBER KL. 18.00'
soup.find(id='deadline-warning').string='Forhåndsvisning: Ingen blir WASTED før påmeldingen er åpnet.'
for id in ['days','hours','minutes','seconds']:
    soup.find(id=id).string='--'
section=soup.new_tag('section',id='pamelding',attrs={'class':'registration-notice'})
section.append(BeautifulSoup('<h2>PÅMELDINGEN ER IKKE ÅPNET.</h2><p>Alle navn, bilder og humorprofiler vises til gjennomgang. Denne versjonen registrerer ikke svar. Ingen er satt som BEINKLAR.</p><p>Felles lagring av svar må kobles til før invitasjonen kan brukes til påmelding.</p><a href="#crew">Tilbake til alle 19 deltakerne ↑</a>','html.parser'))
soup.select_one('.wrap').append(section)
for b in soup.select('[data-share]'):
    b.name='a';b['href']='https://github.com/oleemil/oleemil.github.io/tree/main/hyttelan';b.string='GITHUB ↗';b.attrs.pop('data-share',None)
cal=soup.find(id='calendar')
if cal:
    cal.name='a';cal['href']='#pamelding';cal.string='Se påmeldingsstatus ↗'
css='''
.static-review-bar{background:#29112c;border-bottom:1px solid #68416e;color:#f2ceff;text-align:center;padding:12px 20px;font:10px/1.7 var(--mono);letter-spacing:1px}
.crew-grid{grid-template-columns:repeat(3,minmax(0,1fr));gap:22px}.profile-open{border:1px solid #9a6da5;content-visibility:visible!important;opacity:1!important}.profile-open h3{color:#fff5fc!important;text-decoration:none!important;font-size:28px}.profile-head{height:205px;background:radial-gradient(ellipse at top,#73476f,#25182e 68%,#160e20);position:relative;display:flex;align-items:center;justify-content:center}.profile-head .profile-photo{width:120px;height:120px;object-fit:cover;border:2px solid #e1b1ec;border-radius:50%;box-shadow:0 0 24px #ff4fa21c}.profile-initials{width:120px;height:120px;border:2px solid #c998d6;border-radius:50%;display:grid;place-items:center;font:54px var(--display);color:#eac4f6}.profile-badge{position:absolute;bottom:10px;left:14px;right:14px;text-align:center;font:9px/1.5 var(--mono);background:#22132a;border:1px solid #a17bac;border-radius:3px;padding:5px;color:#f5d5ff}.no-photo-note{position:absolute;top:10px;right:12px;font:6px var(--mono);color:#cdb5d7}.profile-open .card-body{padding:22px}.profile-open .card-body p{font-size:14px;line-height:1.75}.profile-open .card-body h4{font-size:9px;margin-top:22px}.profile-open .nickname{font-size:11px;line-height:1.6}.profile-open .fiction{font-size:9px;line-height:1.7}.profile-search{flex:1;max-width:390px}.profile-search label{font-size:12px;display:block;margin-bottom:6px}.profile-search input{width:100%;padding:12px;border:1px solid #956da1;color:#fff;background:#21142c;border-radius:5px;font-size:16px}.profile-counter{font:22px var(--display);color:#e8c6f4;white-space:nowrap}.registration-notice{padding:27px;background:#211529;border:1px solid #936499;border-radius:6px;margin-bottom:40px;scroll-margin-top:30px}.registration-notice h2{font:30px var(--display);color:#f799d1}.registration-notice p{font-size:13px;line-height:1.8;color:#e1cbe9;margin-top:13px}.registration-notice a{display:inline-block;color:#ffb3df;text-decoration:underline;margin-top:18px;font-size:13px}.polaroid img{height:auto}.polaroids>*{min-width:0}.profile-open[hidden]{display:none!important}
@media(max-width:1050px){.crew-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:600px){.crew-grid{grid-template-columns:1fr}.profile-head{height:192px}.profile-open .card-body h3{font-size:29px}.profile-counter{font-size:18px}.crew-tools{align-items:flex-end;gap:16px}.static-review-bar{font-size:8px;letter-spacing:.5px}.profile-search{max-width:230px}.profile-open .card-body{padding:21px}.crew-header h2{font-size:38px}.crew-header p{font-size:11px}.registration-notice{padding:21px}.registration-notice h2{font-size:27px}}@media(print){.hero,.world-tags,.north-stamp,.deadline,.story,.mission,.footer,.profile-search{display:none}.crew-grid{display:block}.card{break-inside:avoid;margin-bottom:15px}.crew-header{margin-top:20px}}
'''
style=soup.new_tag('style');style.string=css;soup.head.append(style)
# Optional enhancement filters existing HTML only. Failure cannot hide the initial roster.
script=soup.new_tag('script');script.string='''(()=>{'use strict';const field=document.getElementById('profile-search');const cards=Array.from(document.querySelectorAll('.profile-open'));if(field)field.addEventListener('input',()=>{const q=field.value.trim().toLocaleLowerCase('nb-NO');let n=0;for(const c of cards){const show=c.dataset.search.includes(q);c.hidden=!show;if(show)n++;}document.getElementById('profile-count').textContent=n;});const note=document.getElementById('preview-note');if(note)note.hidden=location.hostname!=='htmlpreview.github.io';function tick(){const sec=Math.max(0,Math.floor((Date.parse('2026-09-25T18:00:00+02:00')-Date.now())/1000));[Math.floor(sec/86400),Math.floor(sec/3600)%24,Math.floor(sec/60)%60,sec%60].forEach((v,i)=>{const e=document.getElementById(['days','hours','minutes','seconds'][i]);if(e)e.textContent=String(v).padStart(2,'0');});}tick();setInterval(tick,1000);})();'''
soup.body.append(script)
soup.title.string='Hyttelan VI · Alle 19 deltakere · Åpne profiler'
output=str(soup)
check=BeautifulSoup(output,'html.parser')
assert len(check.select('.profile-open'))==19
assert len(check.select('img.profile-photo'))==18
assert all(p['name'] in check.get_text() for p in people)
assert not check.select('.profile-open[hidden]')
assert 'hovden-hyttelan-2026.higgsfield.app' not in output
(ROOT / 'deltakere.html').write_text(output)
(ROOT / 'index.html').write_text(output)
print('Rendered 19 real-name profiles, 18 embedded photos, and 1 initials fallback. No JavaScript or database needed for visibility.')
