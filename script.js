/* ============================================================
   inmoment · v6
   Side-intro, nav (solid + skjul/vis), mobilmeny, reveal,
   hero-video m/innfading, scrollspy, parallax, marquee, filter,
   lightbox m/pilnavigasjon + sveip, FAQ-akkordeon, ankerscroll.
   Vanilla JS, ingen avhengigheter. Tåler fraværende elementer.
   ============================================================ */

(function () {
  'use strict';

  /* ---- Små hjelpere ---- */
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hasIO = 'IntersectionObserver' in window;

  // Elementer som kan motta fokus (brukes av fokus-feller)
  const FOCUSABLE_SEL =
    'a[href], button:not([disabled]), input:not([disabled]), ' +
    'select:not([disabled]), textarea:not([disabled]), summary, ' +
    '[tabindex]:not([tabindex="-1"])';

  const getFocusable = (root) =>
    $$(FOCUSABLE_SEL, root).filter((el) => el.getClientRects().length > 0);

  // Fang Tab/Shift+Tab innen en dialog (lightbox / mobilmeny)
  const trapFocus = (e, root) => {
    const items = getFocusable(root);
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (!root.contains(document.activeElement)) {
      e.preventDefault();
      first.focus();
    } else if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  /* ---- Årstall i footer (kjører alltid) ---- */
  $$('#year').forEach((el) => {
    el.textContent = new Date().getFullYear();
  });

  /* ---- Side-intro: .is-loaded på body når siden er klar ----
     Settes ved window.load ELLER når DOM + fonter er klare.
     Hard timeout på 1200 ms sørger for at klassen ALLTID settes,
     også hvis hero-videoen henger på tregt nett. */
  let isLoadedSet = false;
  const setLoaded = () => {
    if (isLoadedSet) return;
    isLoadedSet = true;
    document.body.classList.add('is-loaded');
  };
  window.setTimeout(setLoaded, 1200);
  window.addEventListener('load', setLoaded, { once: true });
  if (document.fonts && document.fonts.ready) {
    const whenFontsReady = () => {
      document.fonts.ready.then(setLoaded).catch(setLoaded);
    };
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', whenFontsReady, { once: true });
    } else {
      whenFontsReady();
    }
  }

  /* Hovedløp i try/catch: skulle noe feile halvveis,
     sørger fallbacken for at alt innhold likevel blir synlig. */
  try {
    /* ---- Hero-video: spill av kun når synlig ---- */
    const heroVideo = $('.hero-video');
    if (heroVideo) {
      heroVideo.muted = true;
      heroVideo.playsInline = true;

      // Fade videoen inn når den faktisk spiller, ut igjen ved pause/tomming
      heroVideo.addEventListener('playing', () => {
        heroVideo.classList.add('is-playing');
      });
      ['pause', 'emptied'].forEach((evt) => {
        heroVideo.addEventListener(evt, () => {
          heroVideo.classList.remove('is-playing');
        });
      });
      // Hvis videoen allerede spiller når scriptet kjører
      if (heroVideo.readyState >= 3 && !heroVideo.paused) {
        heroVideo.classList.add('is-playing');
      }

      if (reducedMotion) {
        // Respekter reduced motion: ingen autoplay, vis poster/første frame
        heroVideo.removeAttribute('autoplay');
        heroVideo.pause();
      } else {
        let inView = true;

        const tryPlay = () => {
          if (!inView || document.hidden) return;
          heroVideo.play().catch(() => {});
        };
        const pauseVideo = () => {
          if (!heroVideo.paused) heroVideo.pause();
        };

        tryPlay();
        heroVideo.addEventListener('canplay', tryPlay, { once: true });

        // Pause når videoen er utenfor viewport, spill av igjen når synlig
        if (hasIO) {
          const videoIO = new IntersectionObserver(
            (entries) => {
              inView = entries[0].isIntersecting;
              if (inView) tryPlay();
              else pauseVideo();
            },
            { threshold: 0.1 }
          );
          videoIO.observe(heroVideo);
        }

        // Pause når fanen er skjult, fortsett når synlig igjen
        document.addEventListener('visibilitychange', () => {
          if (document.hidden) pauseVideo();
          else tryPlay();
        });

        // Fallback: start ved første interaksjon hvis autoplay ble blokkert
        ['touchstart', 'click', 'scroll'].forEach((evt) => {
          window.addEventListener(evt, tryPlay, { once: true, passive: true });
        });
      }
    }

    /* ---- Nav: papirbakgrunn etter hero + skjul/vis ved scroll ---- */
    const nav = $('.nav');
    if (nav) {
      // .hero på forsiden, .page-hero på undersider, ellers lav terskel
      const heroEl = $('.hero') || $('.page-hero');
      const limit = () => (heroEl ? heroEl.offsetHeight - 90 : 24);
      const HIDE_AFTER = 400; // px ned før nav kan skjules
      const HIDE_DELTA = 4; // px bevegelse før vi reagerer (mot flimmer)
      let lastY = window.scrollY;
      let navTicking = false;

      const updateNav = () => {
        const y = window.scrollY;
        document.body.classList.toggle('nav-solid', y > limit());

        // Skjul ved nedscroll, vis ved oppscroll – aldri når
        // menyen er åpen eller vi er nær toppen av siden
        if (document.body.classList.contains('menu-open') || y < HIDE_AFTER) {
          document.body.classList.remove('nav-hidden');
          lastY = y;
        } else if (Math.abs(y - lastY) >= HIDE_DELTA) {
          document.body.classList.toggle('nav-hidden', y > lastY);
          lastY = y;
        }
        navTicking = false;
      };
      const onNavScroll = () => {
        if (!navTicking) {
          navTicking = true;
          window.requestAnimationFrame(updateNav);
        }
      };

      updateNav();
      window.addEventListener('scroll', onNavScroll, { passive: true });
    }

    /* ---- Scrollspy i nav (kun forsiden) ----
     Marker lenken til seksjonen som er i viewport med
     aria-current="location"; attributtet fjernes helt når
     ingen av seksjonene er aktive. */
    const spySections = ['tjenester', 'kontakt']
      .map((id) => document.querySelector("section[id='" + id + "']"))
      .filter(Boolean);
    // Kun forsiden: undersider har selv en #kontakt-seksjon, og setSpy
    // ville ellers fjernet den statiske aria-current="page" i nav-en.
    if (spySections.length && hasIO && document.body.classList.contains('home-page')) {
      const navAnchors = $$('.nav-links a');
      let activeSpyId = null;

      const setSpy = (id) => {
        navAnchors.forEach((a) => {
          const href = a.getAttribute('href') || '';
          if (id && href.slice(-(id.length + 1)) === '#' + id) {
            a.setAttribute('aria-current', 'location');
          } else {
            a.removeAttribute('aria-current');
          }
        });
      };

      const spyIO = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              activeSpyId = entry.target.id;
            } else if (activeSpyId === entry.target.id) {
              activeSpyId = null;
            }
          });
          setSpy(activeSpyId);
        },
        { rootMargin: '-45% 0px -50% 0px', threshold: 0 }
      );
      spySections.forEach((sec) => spyIO.observe(sec));
    }

    /* ---- Mobilmeny: fokus-felle, Escape, klikk utenfor, resize ---- */
    const toggle = $('.nav-toggle');
    const overlay = $('.menu-overlay');
    if (toggle && overlay) {
      let menuLastFocus = null;
      const menuIsOpen = () => document.body.classList.contains('menu-open');

      const setMenu = (open) => {
        if (open === menuIsOpen()) return;
        document.body.classList.toggle('menu-open', open);
        toggle.setAttribute('aria-expanded', String(open));
        toggle.setAttribute('aria-label', open ? 'Lukk meny' : 'Åpne meny');
        overlay.setAttribute('aria-hidden', String(!open));

        if (open) {
          menuLastFocus = document.activeElement;
          const first = getFocusable(overlay)[0];
          window.setTimeout(() => {
            if (first) first.focus();
          }, 60);
        } else if (menuLastFocus && typeof menuLastFocus.focus === 'function') {
          menuLastFocus.focus();
          menuLastFocus = null;
        }
      };

      toggle.addEventListener('click', () => setMenu(!menuIsOpen()));
      $$('a', overlay).forEach((a) => {
        a.addEventListener('click', () => setMenu(false));
      });

      // Lukk ved klikk utenfor menyen
      document.addEventListener('click', (e) => {
        if (menuIsOpen() && !overlay.contains(e.target) && !toggle.contains(e.target)) {
          setMenu(false);
        }
      });

      // Escape lukker, Tab holdes inne i menyen
      document.addEventListener('keydown', (e) => {
        if (!menuIsOpen()) return;
        if (e.key === 'Escape') setMenu(false);
        else if (e.key === 'Tab') trapFocus(e, overlay);
      });

      // Lukk hvis vinduet vokser forbi mobilbruddpunktet
      window.addEventListener(
        'resize',
        () => {
          if (window.innerWidth > 700) setMenu(false);
        },
        { passive: true }
      );
    }

    /* ---- Reveal on scroll ---- */
    const revealables = $$('.reveal');
    if (revealables.length && hasIO && !reducedMotion) {
      const revealIO = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add('is-visible');
              revealIO.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.1, rootMargin: '0px 0px -5% 0px' }
      );
      revealables.forEach((el) => revealIO.observe(el));
    } else {
      revealables.forEach((el) => el.classList.add('is-visible'));
    }

    /* ---- Marquee: paus animasjonen når stripen er ute av viewport ---- */
    const marqueeTrack = $('.marquee-track');
    if (marqueeTrack) {
      if (reducedMotion) {
        marqueeTrack.style.animationPlayState = 'paused';
      } else if (hasIO) {
        const marqueeIO = new IntersectionObserver(
          (entries) => {
            marqueeTrack.style.animationPlayState = entries[0].isIntersecting
              ? 'running'
              : 'paused';
          },
          { threshold: 0 }
        );
        marqueeIO.observe(marqueeTrack);
      }
      // Hover-pause styres av CSS og berøres ikke her.
    }

    /* ---- Myk ankerscroll med nav-offset + fokus til målet ---- */
    $$('a[href^="#"]').forEach((link) => {
      link.addEventListener('click', (e) => {
        const id = link.getAttribute('href');
        if (!id || id === '#') return;
        const target = document.querySelector(id);
        if (!target) return;
        e.preventDefault();

        const navHeight = $('.nav') ? $('.nav').offsetHeight : 0;
        const y = target.getBoundingClientRect().top + window.pageYOffset - navHeight - 8;

        window.scrollTo({ top: y, behavior: reducedMotion ? 'auto' : 'smooth' });
        if (history.pushState) history.pushState(null, '', id);

        // Flytt fokus til målet for skjermlesere (uten å hoppe i scroll)
        if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
        target.focus({ preventScroll: true });
      });
    });

    /* ---- FAQ: bare én <details> åpen om gangen ---- */
    const faqItems = $$('.faq details, details.faq-item');
    faqItems.forEach((item) => {
      item.addEventListener('toggle', () => {
        if (item.open) {
          faqItems.forEach((other) => {
            if (other !== item) other.open = false;
          });
        }
      });
    });

    /* ---- Prosjektfilter ---- */
    const chips = $$('.chip[data-filter]');
    if (chips.length) {
      const items = $$('.archive-item[data-cat]');
      chips.forEach((chip) => {
        chip.addEventListener('click', () => {
          chips.forEach((c) => c.setAttribute('aria-pressed', String(c === chip)));
          const f = chip.dataset.filter;
          items.forEach((item) => {
            item.classList.toggle('is-hidden', f !== 'alle' && item.dataset.cat !== f);
            // Nylig synlige elementer skal ikke henge fast i usynlig reveal
            item.classList.add('is-visible');
          });
        });
      });
    }

    /* ---- Lightbox: piler, tastatur, fokus-felle og sveip ---- */
    const groups = $$('[data-lightbox]');
    if (groups.length) {
      const lb = document.createElement('div');
      lb.className = 'lightbox';
      lb.setAttribute('role', 'dialog');
      lb.setAttribute('aria-modal', 'true');
      lb.setAttribute('aria-hidden', 'true');
      lb.tabIndex = -1;
      lb.innerHTML =
        '<img class="lightbox-img" alt="" />' +
        '<button class="lightbox-close" type="button" aria-label="Lukk">&#10005;</button>' +
        '<button class="lightbox-prev" type="button" aria-label="Forrige">&#8592;</button>' +
        '<button class="lightbox-next" type="button" aria-label="Neste">&#8594;</button>' +
        '<span class="lightbox-caption"></span>';
      document.body.appendChild(lb);

      const lbImg = $('.lightbox-img', lb);
      const lbCap = $('.lightbox-caption', lb);
      const btnClose = $('.lightbox-close', lb);
      const btnPrev = $('.lightbox-prev', lb);
      const btnNext = $('.lightbox-next', lb);

      const SWIPE_THRESHOLD = 50; // px horisontalt for forrige/neste
      const SWIPE_DOWN_THRESHOLD = 70; // px nedover for å lukke

      let current = [];
      let index = 0;
      let lastFocused = null;

      // Forhåndslast nabobilder (index ± 1) for rask navigasjon
      const preloadNeighbors = () => {
        if (!current.length) return;
        [index - 1, index + 1].forEach((n) => {
          const img = current[(n + current.length) % current.length];
          if (img) {
            const pre = new Image();
            pre.src = img.currentSrc || img.src;
          }
        });
      };

      const render = () => {
        const img = current[index];
        if (!img) return;
        lbImg.style.opacity = '0';
        const tmp = new Image();
        tmp.onload = () => {
          lbImg.src = tmp.src;
          lbImg.alt = img.alt || '';
          lbImg.style.opacity = '1';
        };
        tmp.src = img.currentSrc || img.src;
        const label = img.alt ? img.alt + ' — ' : '';
        lbCap.textContent = label + (index + 1) + ' / ' + current.length;
      };

      const open = (imgs, i) => {
        current = imgs;
        index = i;
        render();
        preloadNeighbors();
        lb.classList.add('is-open');
        lb.setAttribute('aria-hidden', 'false');
        document.body.classList.add('lightbox-open');
        lastFocused = document.activeElement;
        window.setTimeout(() => btnClose.focus(), 60);
      };

      const close = () => {
        if (!lb.classList.contains('is-open')) return;
        lb.classList.remove('is-open');
        lb.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('lightbox-open');
        if (lastFocused && typeof lastFocused.focus === 'function') lastFocused.focus();
        lastFocused = null;
      };

      const step = (dir) => {
        if (!current.length) return;
        index = (index + dir + current.length) % current.length;
        render();
        preloadNeighbors();
      };

      groups.forEach((group) => {
        const imgs = $$('img', group).filter((img) => !img.closest('[aria-hidden="true"]'));
        imgs.forEach((img) => {
          const clickable = img.closest('figure, div');
          if (!clickable) return;
          clickable.addEventListener('click', (e) => {
            if (e.target.closest('a')) return;
            e.preventDefault();
            // hopp over elementer som er filtrert bort
            const visible = imgs.filter((i) => !i.closest('.is-hidden'));
            open(visible, Math.max(0, visible.indexOf(img)));
          });
        });
      });

      btnClose.addEventListener('click', close);
      btnPrev.addEventListener('click', () => step(-1));
      btnNext.addEventListener('click', () => step(1));
      lb.addEventListener('click', (e) => {
        if (e.target === lb || e.target === lbImg) close();
      });

      document.addEventListener('keydown', (e) => {
        if (!lb.classList.contains('is-open')) return;
        if (e.key === 'Escape') close();
        else if (e.key === 'ArrowLeft') step(-1);
        else if (e.key === 'ArrowRight') step(1);
        else if (e.key === 'Tab') trapFocus(e, lb);
      });

      /* Sveip: venstre/høyre for forrige/neste, ned for å lukke.
         Bildet følger fingeren; ved for lite sveip fades det tilbake.
         Horisontal bevegelse må dominere for ikke å kollidere med
         vertikal side-scroll (CSS: .lightbox-img { touch-action: pan-y }). */
      let touchStartX = 0;
      let touchStartY = 0;
      let touchDelta = 0;
      let touching = false;
      let swipeAxis = null; // 'x' | 'down' | null (uavgjort)

      const resetSwipeStyles = () => {
        lbImg.style.transition = '';
        lbImg.style.transform = '';
        lbImg.style.opacity = '';
      };

      lb.addEventListener(
        'touchstart',
        (e) => {
          if (e.touches.length !== 1) return;
          touching = true;
          swipeAxis = null;
          touchDelta = 0;
          touchStartX = e.touches[0].clientX;
          touchStartY = e.touches[0].clientY;
          lbImg.style.transition = 'none';
        },
        { passive: true }
      );

      lb.addEventListener(
        'touchmove',
        (e) => {
          if (!touching || e.touches.length !== 1) return;
          const dx = e.touches[0].clientX - touchStartX;
          const dy = e.touches[0].clientY - touchStartY;

          // Avgjør retning først når bevegelsen er tydelig
          if (!swipeAxis) {
            if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
            if (Math.abs(dx) > Math.abs(dy)) swipeAxis = 'x';
            else if (dy > 0) swipeAxis = 'down';
            else return; // oppover-sveip overlates til nettleseren
          }

          if (swipeAxis === 'x') {
            touchDelta = dx;
            lbImg.style.transform = 'translateX(' + dx + 'px)';
            lbImg.style.opacity = String(Math.max(0.4, 1 - Math.abs(dx) / 300));
          } else if (swipeAxis === 'down') {
            touchDelta = dy;
            lbImg.style.transform = 'translateY(' + dy + 'px)';
            lbImg.style.opacity = String(Math.max(0.3, 1 - dy / 350));
          }
        },
        { passive: true }
      );

      const endTouch = () => {
        if (!touching) return;
        touching = false;
        const delta = touchDelta;
        const axis = swipeAxis;
        swipeAxis = null;
        touchDelta = 0;
        resetSwipeStyles();

        if (axis === 'x' && Math.abs(delta) > SWIPE_THRESHOLD) {
          step(delta < 0 ? 1 : -1); // sveip venstre = neste, høyre = forrige
        } else if (axis === 'down' && delta > SWIPE_DOWN_THRESHOLD) {
          close();
        }
        // For lite sveip: bildet fades tilbake via CSS-transition
      };
      lb.addEventListener('touchend', endTouch);
      lb.addEventListener('touchcancel', endTouch);
    }

    /* ---- Subtil parallax på .break-bg ----
     rAF-drevet translate3d, maks ~8 % av elementhøyden.
     Kun på finpointerskjermer, uten reduced motion, og bare
     mens elementet er synlig i viewport. */
    const finePointer = window.matchMedia('(pointer: fine)').matches;
    if (!reducedMotion && finePointer) {
      $$('.break-bg').forEach((bg) => {
        let bgVisible = !hasIO; // uten IO antar vi synlig
        let plxTicking = false;

        const updateParallax = () => {
          plxTicking = false;
          if (!bgVisible) return;
          const rect = bg.getBoundingClientRect();
          const vh = window.innerHeight || document.documentElement.clientHeight;
          if (!rect.height || !vh) return;
          // -1 (under viewport) → +1 (over); 0 når sentrert
          const progress =
            (rect.top + rect.height / 2 - vh / 2) / (vh / 2 + rect.height / 2);
          const clamped = Math.max(-1, Math.min(1, progress));
          const amp = rect.height * 0.08;
          bg.style.transform = 'translate3d(0, ' + (-clamped * amp).toFixed(1) + 'px, 0)';
        };
        const onPlxScroll = () => {
          if (!plxTicking) {
            plxTicking = true;
            window.requestAnimationFrame(updateParallax);
          }
        };

        if (hasIO) {
          const plxIO = new IntersectionObserver(
            (entries) => {
              bgVisible = entries[0].isIntersecting;
              if (bgVisible) updateParallax();
            },
            { threshold: 0 }
          );
          plxIO.observe(bg);
        }
        updateParallax();
        window.addEventListener('scroll', onPlxScroll, { passive: true });
        window.addEventListener('resize', onPlxScroll, { passive: true });
      });
    }
  } catch (err) {
    /* Fallback ved uventet feil: vis alt innhold likevel */
    document.body.classList.add('is-loaded');
    $$('.reveal').forEach((el) => el.classList.add('is-visible'));
    $$('.archive-item').forEach((el) => el.classList.add('is-visible'));
    if (window.console && typeof window.console.error === 'function') {
      window.console.error('inmoment script feilet:', err);
    }
  }
})();
