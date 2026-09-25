"""Sharing card for the existing, approved Hyttelan invitation.
Only local invitation files are changed. No attendance records are written.
The invitation and its social preview are served directly by GitHub Pages.
"""
from pathlib import Path
from datetime import datetime
from zoneinfo import ZoneInfo
import json
import re

ROOT = Path(__file__).resolve().parent
SHARE_URL = 'https://inmoment.no/hyttelan/'
IMAGE_NAME = 'hyttelan-share-20260927.jpg'
IMAGE_URL = SHARE_URL + 'assets/' + IMAGE_NAME
DEADLINE = int(datetime(2026, 9, 27, 18, tzinfo=ZoneInfo('Europe/Oslo')).timestamp() * 1000)
TITLE = 'HYTTELAN VI · SAMME GJENG. NYTT KAOS.'
DESCRIPTION = 'Hovden · 19. november 2026. Er du beinklar? Svar innen søndag 27. september kl. 18.00 norsk tid.'
ALT = 'Hytta fra Hyttelan-forsiden i rosa og lilla GTA-stil, med HYTTELAN VI og Samme gjeng. Nytt kaos.'


def configure_share(soup):
    """Serve crawlable metadata with the page itself, without a preview intermediary."""
    for tag in list(soup.find_all('meta')):
        if tag.get('property', '').startswith('og:') or tag.get('name', '').startswith('twitter:'):
            tag.decompose()
    for tag in soup.select('link[rel="canonical"], link[rel="image_src"]'):
        tag.decompose()
    for key, value in [
        ('og:type', 'website'), ('og:url', SHARE_URL), ('og:site_name', 'HYTTELAN VI'),
        ('og:locale', 'nb_NO'), ('og:title', TITLE), ('og:description', DESCRIPTION),
        ('og:image', IMAGE_URL), ('og:image:secure_url', IMAGE_URL),
        ('og:image:type', 'image/jpeg'), ('og:image:width', '1200'),
        ('og:image:height', '630'), ('og:image:alt', ALT),
    ]:
        soup.head.append(soup.new_tag('meta', attrs={'property': key, 'content': value}))
    for key, value in [
        ('twitter:card', 'summary_large_image'), ('twitter:title', TITLE),
        ('twitter:description', DESCRIPTION), ('twitter:image', IMAGE_URL),
        ('twitter:image:alt', ALT),
    ]:
        soup.head.append(soup.new_tag('meta', attrs={'name': key, 'content': value}))
    soup.head.append(soup.new_tag('link', attrs={'rel': 'canonical', 'href': SHARE_URL}))
    soup.head.append(soup.new_tag('link', attrs={'rel': 'image_src', 'href': IMAGE_URL}))
    description = soup.find('meta', attrs={'name': 'description'})
    if description:
        description['content'] = DESCRIPTION
    deadline = soup.find(id='deadline-text')
    if deadline:
        deadline.string = 'SVARFRIST: SØNDAG 27. SEPTEMBER KL. 18.00'


def patch_sources():
    """Precisely update the existing source; retain all design and RSVP logic."""
    build = ROOT / 'build-live.py'
    text = build.read_text()
    if 'from share_preview import' not in text:
        assert 'from bs4 import BeautifulSoup' in text
        text = text.replace('from bs4 import BeautifulSoup', 'from bs4 import BeautifulSoup\nfrom share_preview import configure_share, DEADLINE, SHARE_URL', 1)
        assert "'deadline':1790352000000" in text
        text = text.replace("'deadline':1790352000000", "'deadline':DEADLINE", 1)
        text = text.replace("config.pop('guestIds')", "config.pop('guestIds')\nconfig['shareUrl']=SHARE_URL", 1)
        assert 'output=str(soup)' in text
        text = text.replace('output=str(soup)', 'configure_share(soup)\noutput=str(soup)', 1)
        build.write_text(text)
    client = ROOT / 'live-client.js'
    js = client.read_text()
    js, count = re.subn(r'async function share\(\)\{const url=.*?;try\{',
        "async function share(){const url=C.shareUrl||" + json.dumps(SHARE_URL) + ";try{", js, count=1)
    assert count == 1, 'Expected exactly one existing share function'
    assert 'raw.githack.com' not in js, 'Sharing must not lead to a confirmation interstitial'
    client.write_text(js)
    assert DEADLINE == 1790524800000


def render_card():
    """Screenshot only the existing hero, using the existing local cabin artwork."""
    from bs4 import BeautifulSoup
    from playwright.sync_api import sync_playwright
    from PIL import Image
    soup = BeautifulSoup((ROOT / 'index.html').read_text(), 'html.parser')
    hero = soup.select_one('.hero')
    assert hero is not None
    original_art = hero.select_one('.hero-art img')
    assert original_art is not None
    assert 'cabin-vice-city.webp' in original_art['src'], 'Do not substitute a different cabin'
    cabin = ROOT / 'assets' / 'cabin-vice-city.webp'
    assert cabin.is_file()
    original_art['src'] = cabin.as_uri()
    for tag in hero.select('.hero-actions, .hero-note, .world-tags, .wanted'):
        tag.decompose()
    styles = '\n'.join(str(s) for s in soup.head.find_all('style'))
    font_links = '\n'.join(str(t) for t in soup.head.find_all('link') if 'fonts.googleapis.com' in t.get('href', ''))
    card = '''<!doctype html><html lang="nb"><head><meta charset="utf-8">''' + font_links + styles + '''<style>
      html,body{margin:0;width:1200px;height:630px;overflow:hidden}
      .hero{width:1200px;height:630px;min-height:630px;max-height:630px}
      .hero-copy{padding-top:42px}.hero-art img{object-position:50% 58%}
      .north-stamp{right:5%;top:45px}
      .share-footer{position:absolute;bottom:28px;left:5.5%;right:5.5%;display:flex;justify-content:space-between;align-items:center;gap:24px;font:700 15px 'Barlow',sans-serif;color:#fff9ff;text-shadow:0 2px 7px #000}
      .share-footer span:last-child{background:#ff4fa2;color:#17071a;text-shadow:none;border:1px solid #ffafda;border-radius:4px;padding:11px 17px}
    </style></head><body>''' + str(hero) + '''<div class="share-footer"><span>HOVDEN · 19. NOVEMBER 2026</span><span>SVAR INNEN SØNDAG 27. SEPTEMBER KL. 18.00</span></div></body></html>'''
    temporary = ROOT / '.share-card-render.html'
    temporary.write_text(card)
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch()
            page = browser.new_page(viewport={'width': 1200, 'height': 630}, device_scale_factor=1)
            page.goto(temporary.as_uri(), wait_until='networkidle', timeout=60000)
            page.evaluate('document.fonts.ready')
            assert page.locator('.hero-art img').evaluate('(img)=>img.complete&&img.naturalWidth>0')
            page.screenshot(path=str(ROOT / 'assets' / IMAGE_NAME), type='jpeg', quality=93)
            browser.close()
    finally:
        temporary.unlink(missing_ok=True)
    im = Image.open(ROOT / 'assets' / IMAGE_NAME)
    assert im.size == (1200, 630) and im.format == 'JPEG'
    assert (ROOT / 'assets' / IMAGE_NAME).stat().st_size < 1_000_000
    print('Rendered the approved cabin/hero as a 1200 × 630 JPEG sharing card.')


if __name__ == '__main__':
    import sys
    if len(sys.argv) != 2 or sys.argv[1] not in ('patch', 'render'):
        raise SystemExit('Usage: python hyttelan/share_preview.py patch|render')
    patch_sources() if sys.argv[1] == 'patch' else render_card()
