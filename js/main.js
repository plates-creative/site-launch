/* Plates Studio — site scripts
   Clocks, thumbnail height lock, video thumbnails, theme easter egg (PS mark),
   scroll reveal, footer year, email form placeholder, cursor dot, globe extras
   (dot size + automatic dots), mobile hero scene.
   The wireframe globe is js/globe.js; the goo effect is js/goo-text.js. */

/* ---------- Live clocks (ATX / SF) ---------- */
(function clocks() {
  const els = document.querySelectorAll('time[data-tz]');
  if (!els.length) return;

  const formatters = new Map();
  const fmt = (tz) => {
    if (!formatters.has(tz)) {
      formatters.set(tz, new Intl.DateTimeFormat('en-US', {
        timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
      }));
    }
    return formatters.get(tz);
  };

  // HH, a blinking colon (CSS), MM. The blink is lined up with real seconds.
  els.forEach((el) => {
    el.innerHTML = '<span data-h>00</span><span class="clock__colon">:</span><span data-m>00</span>';
  });
  document.documentElement.style.setProperty('--blink-offset', (-(Date.now() % 1000) / 1000) + 's');

  function tick() {
    const now = new Date();
    els.forEach((el) => {
      const parts = fmt(el.dataset.tz).formatToParts(now);
      const get = (type) => (parts.find((p) => p.type === type) || {}).value || '00';
      el.querySelector('[data-h]').textContent = get('hour');
      el.querySelector('[data-m]').textContent = get('minute');
      el.dateTime = now.toISOString();
    });
    // Re-run at the top of the next minute
    setTimeout(tick, 60000 - (now.getSeconds() * 1000 + now.getMilliseconds()) + 50);
  }
  tick();
})();

/* ---------- Thumbnail rows: lock resting height ----------
   Works out each row's height as if nothing were hovered (from each slot's
   flex-grow and aspect ratio) and pins the row to it. The hover grow then
   spills into the gap below instead of moving the rest of the page.
   Recalculates whenever the row's width changes. */
(function lockThumbRows() {
  const rows = document.querySelectorAll('.thumbnail-stack');
  if (!rows.length) return;

  function measure(row) {
    const cs = getComputedStyle(row);
    const items = [...row.children];
    const gap = parseFloat(cs.columnGap) || 0;
    const inner = row.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const avail = inner - gap * (items.length - 1);
    let total = 0;
    const parts = items.map((el) => {
      const s = getComputedStyle(el);
      const grow = parseFloat(s.getPropertyValue('--grow')) || 1;
      const [w, h] = s.aspectRatio.split('/').map(parseFloat);
      total += grow;
      return { grow, ratio: h ? w / h : w || 1 };
    });
    const restH = Math.max(...parts.map((p) => (avail * p.grow / total) / p.ratio));
    row.style.setProperty('--rest-h', Math.ceil(restH) + 'px');
  }

  const ro = new ResizeObserver((entries) => entries.forEach((e) => measure(e.target)));
  rows.forEach((row) => { measure(row); ro.observe(row); });
})();

/* ---------- Video thumbnails ----------
   Any <video> in a thumbnail slot is treated as a silent, looping visual:
   no controls, no sound, no picture-in-picture. It plays only while it's on
   (or near) the screen and pauses when scrolled away, so several videos on
   the page don't fight for the phone's battery or bandwidth.
   If the browser blocks autoplay (e.g. iPhone Low Power Mode) or the visitor
   asks for reduced motion, the poster frame simply stays up.
   Markup: <video src="…mp4" poster="…jpg" muted loop playsinline preload="metadata"></video> */
(function videoThumbs() {
  const videos = [...document.querySelectorAll('.thumb video')];
  if (!videos.length) return;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');

  // These properties also set the matching HTML attributes, which is what
  // iOS checks before it allows silent autoplay.
  videos.forEach((v) => {
    v.muted = v.defaultMuted = true;
    v.loop = true;
    v.playsInline = true;
    v.controls = false;
    v.autoplay = false;               // playback is driven by visibility below
    v.disablePictureInPicture = true;
    v.disableRemotePlayback = true;
    v.tabIndex = -1;
    if (!v.hasAttribute('aria-label')) v.setAttribute('aria-hidden', 'true');
  });

  const visible = new Set();
  const play = (v) => {
    if (reduce.matches) return;
    const p = v.play();
    if (p && p.catch) p.catch(() => {});   // autoplay refused: keep the poster
  };
  const update = () => videos.forEach((v) => (visible.has(v) && !document.hidden ? play(v) : v.pause()));

  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => (e.isIntersecting ? visible.add(e.target) : visible.delete(e.target)));
    update();
  }, { rootMargin: '200px 0px' });
  videos.forEach((v) => io.observe(v));

  document.addEventListener('visibilitychange', update);
  reduce.addEventListener?.('change', update);
})();

/* ---------- Theme easter egg (PS mark) ----------
   Click/tap the pinned PS mark to cycle dark → light → pink.
   Only colors change: nothing re-lays out, re-initialises or scrolls, so the
   visitor stays exactly where they are. The CSS cross-fades the page colors;
   this keeps the WebGL goo headings in step with that fade, frame by frame.
   Resets to dark on every visit. */
(function themeCycle() {
  const btn = document.querySelector('.ps-mark');
  if (!btn) return;
  const root = document.documentElement;
  const meta = document.querySelector('meta[name="theme-color"]');
  const status = document.querySelector('[data-theme-status]');
  const themes = [
    { name: 'dark',  label: 'Dark',  chrome: '#181818' },
    { name: 'light', label: 'Light', chrome: '#dbdbdb' },
    { name: 'pink',  label: 'Pink',  chrome: '#ff3eb5' }
  ];
  let index = 0;

  const durationMs = () => {
    const v = getComputedStyle(root).getPropertyValue('--theme-duration').trim();
    const n = parseFloat(v) || 0.6;
    return v.endsWith('ms') ? n : n * 1000;
  };

  let until = 0, running = false;
  function followGoo() {
    const goo = [...document.querySelectorAll('[data-goo]')]
      .map((el) => el.__goo).filter((g) => g && g.recolor);
    if (!goo.length) return;
    until = performance.now() + durationMs() + 120;
    if (running) return;
    running = true;
    (function tick(now) {
      goo.forEach((g) => g.recolor());
      if (now < until) requestAnimationFrame(tick); else running = false;
    })(performance.now());
  }

  // Full 360° spin on every click. The angle keeps adding up, so each click
  // spins forward again, and a click mid-spin just extends it smoothly.
  const svg = btn.querySelector('.ps-mark__svg');
  let spin = 0;

  // Pink turns the header/mark difference blend off. Entering pink, switch
  // right away; leaving pink, wait until the fade has finished. Their colors
  // are matched to what the blend shows, so neither switch is visible.
  let plainTimer = 0;
  function setChrome(themeName) {
    clearTimeout(plainTimer);
    if (themeName === 'pink') {
      root.classList.add('chrome-plain');
    } else if (root.classList.contains('chrome-plain')) {
      plainTimer = setTimeout(() => root.classList.remove('chrome-plain'), durationMs() + 50);
    }
  }

  btn.addEventListener('click', () => {
    spin += 360;
    if (svg) svg.style.setProperty('--spin', spin + 'deg');

    index = (index + 1) % themes.length;
    const t = themes[index];
    setChrome(t.name);
    root.dataset.theme = t.name;
    if (meta) meta.content = t.chrome;
    if (status) status.textContent = `${t.label} color theme`;
    followGoo();
  });
})();

/* ---------- Cursor dot ----------
   Mouse/trackpad only: a 14px dot that follows the pointer with a difference
   blend, so it inverts whatever it passes over. Colour per theme comes from
   --cursor-color in styles.css. The system cursor is hidden only once the dot
   is actually showing. */
(function cursorDot() {
  if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  const dot = document.createElement('div');
  dot.className = 'cursor-dot';
  dot.setAttribute('aria-hidden', 'true');
  document.body.appendChild(dot);
  const root = document.documentElement;
  addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch') return;
    dot.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0)`;
    if (!dot.classList.contains('is-on')) { dot.classList.add('is-on'); root.classList.add('has-cursor-dot'); }
  }, { passive: true });
  document.addEventListener('mouseout', (e) => { if (!e.relatedTarget) dot.classList.remove('is-on'); });
})();

/* ---------- Globe extras ----------
   1. Dot size: 14px on desktop; 50% larger than before on mobile.
   2. A dot lands on a random spot on the front of the globe every 3 seconds
      while it's on screen, so it's clear the globe can be added to.
   Runs after globe.js has set the globe up. */
addEventListener('DOMContentLoaded', function globeExtras() {
  const el = document.querySelector('[data-globe]');
  const g = el && el.__globe;
  if (!g) return;

  const mobile = matchMedia('(max-width: 809px)');
  const size = () => {
    el.setAttribute('data-globe-dot-size', mobile.matches ? '20.2' : '14');   // 20.2 ≈ 6.9px on a 402 screen
    g.refresh();
  };
  size();
  mobile.addEventListener?.('change', size);

  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  let visible = false;
  new IntersectionObserver((en) => { visible = en[0].isIntersecting; }).observe(el);
  setInterval(() => {
    if (!visible || document.hidden || reduce.matches || !g.outline) return;
    // random point inside the globe's outline (kept off the very edge), dropped
    // exactly like a click so it pins to the globe and spins with it
    const r = g.outline.getBoundingClientRect();
    const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * 0.9;
    g.onClick({
      clientX: r.left + r.width / 2 + Math.cos(a) * d * r.width / 2,
      clientY: r.top + r.height / 2 + Math.sin(a) * d * r.height / 2,
      target: el
    });
  }, 3000);
});

/* ---------- Mobile hero scene ----------
   On phones the XL line and the descriptor stay centred on screen while you
   scroll: the XL line fades out, then the descriptor fades in and back out.
   The amount of scrolling is --hero-travel in styles.css. */
(function heroScene() {
  const hero = document.querySelector('.hero');
  if (!hero) return;
  const line = hero.querySelector('.hero-text');
  const desc = hero.querySelector('.descriptor-line p');
  const root = document.documentElement;
  const mobile = matchMedia('(max-width: 809px)');
  const ramp = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  let queued = false;

  function update() {
    queued = false;
    if (!root.classList.contains('hero-scene')) return;
    const r = hero.getBoundingClientRect();
    const travel = Math.max(1, r.height - innerHeight);
    const s = Math.min(1, Math.max(0, -r.top / travel));      // 0 → 1 through the scene
    line.style.opacity = (1 - ramp(0.10, 0.40, s)).toFixed(3);
    desc.style.opacity = (ramp(0.40, 0.60, s) * (1 - ramp(0.82, 1.0, s))).toFixed(3);
  }
  const queue = () => { if (!queued) { queued = true; requestAnimationFrame(update); } };

  function setMode() {
    if (mobile.matches) { root.classList.add('hero-scene'); update(); }
    else { root.classList.remove('hero-scene'); line.style.opacity = ''; desc.style.opacity = ''; }
  }
  setMode();
  mobile.addEventListener?.('change', setMode);
  addEventListener('scroll', queue, { passive: true });
  addEventListener('resize', queue);
})();

/* ---------- Scroll reveal ----------
   See the CSS section "Scroll reveal" for the markup. Each item fades in once,
   when its top edge is ~12% up into the viewport. Anything that comes into
   view at the same moment (e.g. on page load) goes in reading order.
   Line-by-line text: words are wrapped in spans, grouped by the line they sit
   on, faded in line after line, then unwrapped again so the DOM goes back to
   plain text (nothing changes for screen readers, selection or translation).
   The first reveal waits for the web fonts (max ~1.2s) so line breaks are
   measured in Owners, not a fallback. */
(function scrollReveal() {
  const root = document.documentElement;
  if (!root.classList.contains('reveal')) return;          // early script didn't run / timed out
  const UNITS = '[data-reveal], [data-reveal-lines], [data-reveal-group] > *';
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) {
    document.querySelectorAll(UNITS).forEach((el) => el.classList.add('is-in'));
    root.classList.add('reveal-ready');
    return;
  }
  root.classList.add('reveal-ready');

  const css = getComputedStyle(root);
  const ms = (name, fallback) => {
    const v = css.getPropertyValue(name).trim(), n = parseFloat(v);
    if (!Number.isFinite(n)) return fallback;
    return v.endsWith('ms') ? n : n * 1000;
  };
  const stagger = ms('--reveal-stagger', 99);
  const lineStagger = ms('--reveal-line-stagger', 120);
  const duration = ms('--reveal-duration', 1320);

  /* --- split text into word spans (keeps links, <strong> etc. intact) --- */
  function split(el) {
    if (el.classList.contains('rl-split')) return;
    // Goo text is drawn as one WebGL layer, so it can't fade per line:
    // it fades in as a whole instead (on touch, where goo is off, it still splits)
    if (el.__goo) return;
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach((node) => {
      const parts = node.data.split(/(\s+)/);
      if (parts.length < 2 && !node.data.trim()) return;
      const frag = document.createDocumentFragment();
      parts.forEach((part) => {
        if (!part) return;
        if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
        const w = document.createElement('span');
        w.className = 'rl-w';
        w.textContent = part;
        frag.appendChild(w);
      });
      node.replaceWith(frag);
    });
    el.classList.add('rl-split');
    measure(el);
  }

  /* --- give each word the index of the line it sits on --- */
  function measure(el) {
    let line = -1, lastTop = -Infinity;
    el.querySelectorAll('.rl-w').forEach((w) => {
      const top = w.getBoundingClientRect().top;
      if (top > lastTop + 2) { line++; lastTop = top; }
      w.style.setProperty('--line', line);
      // list items: the bullet fades in with the item's first line
      const li = w.closest('li');
      if (li && el.contains(li) && !li.__rlFirst) { li.__rlFirst = true; li.style.setProperty('--line', line); }
    });
    el.querySelectorAll('li').forEach((li) => { delete li.__rlFirst; });
    el.dataset.lines = line + 1;
  }

  /* --- put the plain text back once the fade has finished --- */
  function unsplit(el) {
    el.querySelectorAll('.rl-w').forEach((w) => w.replaceWith(document.createTextNode(w.textContent)));
    el.querySelectorAll('li[style]').forEach((li) => {
      li.style.removeProperty('--line');
      if (!li.getAttribute('style')) li.removeAttribute('style');
    });
    el.normalize();
  }

  function reveal(el, delay) {
    el.style.setProperty('--reveal-delay', delay + 'ms');
    el.classList.add('is-in');
    if (el.classList.contains('rl-split')) {
      const lines = +el.dataset.lines || 1;
      setTimeout(() => unsplit(el), delay + (lines - 1) * lineStagger + duration + 100);
      return lines;                      // steps this item takes up in the sequence
    }
    return 1;
  }

  const pending = new Set();          // observed, not yet revealed (see fallback below)
  const io = new IntersectionObserver((entries) => {
    const hits = entries.filter((e) => e.isIntersecting)
      .sort((a, b) => (a.target.compareDocumentPosition(b.target) & Node.DOCUMENT_POSITION_FOLLOWING) ? -1 : 1);
    let t = 0;
    hits.forEach(({ target }) => {
      io.unobserve(target);
      pending.delete(target);
      const items = target.hasAttribute('data-reveal-group') ? [...target.children] : [target];
      items.forEach((item) => {
        const steps = reveal(item, t);
        // the next item starts as this one's last line begins
        t += item.classList.contains('rl-split') ? steps * lineStagger : stagger;
      });
    });
  }, { rootMargin: '0px 0px -12% 0px' });

  // keep line groupings right if the window is resized before text is revealed
  let resizeTimer = 0;
  addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      document.querySelectorAll('.rl-split:not(.is-in)').forEach(measure);
    }, 150);
  });

  // Fallback: anything scrolled past without ever being seen (End key, a fast
  // fling, an anchor jump) never triggers the observer, so it would stay
  // hidden above the viewport. Check for those once scrolling settles.
  let settleTimer = 0;
  addEventListener('scroll', () => {
    clearTimeout(settleTimer);
    settleTimer = setTimeout(() => {
      pending.forEach((t) => {
        if (t.getBoundingClientRect().top < innerHeight * 0.88) {
          pending.delete(t);
          io.unobserve(t);
          const items = t.hasAttribute('data-reveal-group') ? [...t.children] : [t];
          items.forEach((item) => reveal(item, 0));
        }
      });
    }, 120);
  }, { passive: true });

  function start() {
    document.querySelectorAll('[data-reveal-lines]').forEach(split);
    document.querySelectorAll('[data-reveal], [data-reveal-group], [data-reveal-lines]').forEach((t) => {
      if (t.matches('[data-reveal-group] > *')) return;   // revealed by its group
      pending.add(t);
      io.observe(t);
    });
  }
  const fontsReady = document.fonts && document.fonts.ready
    ? Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1200))])
    : Promise.resolve();
  fontsReady.then(() => requestAnimationFrame(start));
})();

/* ---------- Footer year ---------- */
document.querySelectorAll('[data-year]').forEach((el) => {
  el.textContent = new Date().getFullYear();
});

/* ---------- Email signup ----------
   Placeholder handler. Nothing is sent anywhere yet — swap in the real
   endpoint (Mailchimp, Buttondown, etc.) when it's decided. */
(function signup() {
  const form = document.querySelector('.email');
  if (!form) return;
  const input = form.querySelector('input[type="email"]');
  const status = form.querySelector('.email__status');

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!input.value || !input.checkValidity()) {
      status.textContent = 'Please enter a valid email.';
      input.focus();
      return;
    }
    status.textContent = 'Thanks, you’re on the list.';
    form.reset();
  });
})();
