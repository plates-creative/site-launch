/*! globe.js — Plates wireframe globe (drop-in, no dependencies)
 *
 * A wireframe globe that spins horizontally in true 3D. Every frame is
 * computed from the rotation angle, so the spin never has a loop point.
 *
 * Usage
 *   <section style="position: relative">
 *     <div data-globe aria-hidden="true"></div>
 *     ...your section content...
 *   </section>
 *   <script src="/js/globe.js" defer></script>
 *
 * The globe fills its parent (position: absolute; inset: 0) unless you
 * position the element yourself. Line colour comes from the CSS `color`
 * of the element, so style it in CSS:
 *   [data-globe] { color: #DBDBDB; z-index: 0; }
 *   section > :not([data-globe]) { position: relative; z-index: 1; }
 *
 * Attributes (all optional; the defaults are the plates.studio settings)
 *   data-globe-style      "lens"      curves meet at the left and right points
 *                         "parallels" true latitude lines                 (default parallels)
 *   data-globe-meridians  vertical lines around the full globe        (default 24)
 *   data-globe-rings      horizontal lines                            (default 9)
 *   data-globe-period     seconds for one full turn                   (default 45)
 *   data-globe-direction  1 spins left to right, -1 right to left     (default 1)
 *   data-globe-tilt       degrees the camera looks down from above    (default 0)
 *   data-globe-aspect     globe width divided by height               (default 2.2)
 *   data-globe-back       opacity of lines on the far side, 0 to 1    (default 0.4)
 *   data-globe-stroke     line width in screen pixels                 (default 1)
 *   data-globe-follow     degrees the globe tips toward the mouse,    (default 24, 0 is off)
 *                         up/down tilts it, left/right turns it
 *   data-globe-ease       how fast it catches up to the mouse, 0 to 1 (default 0.06)
 *   data-globe-opacity    opacity of the lines only, 0 to 1           (default 0.28)
 *   data-globe-dots       max dots a click/tap can drop, 0 is off     (default 100)
 *                         oldest dot is removed past the limit
 *   data-globe-dot-size   dot diameter in pixels when the globe is    (default 12)
 *                         drawn at its reference width (below); dots
 *                         grow and shrink with the globe from there
 *   data-globe-dot-ref    the globe width, in pixels, that counts as  (default 1000)
 *                         100% size for dot-size
 *   data-globe-dot-color  any CSS colour                              (default #FF3EB5)
 *   data-globe-fit        "contain" or "cover"                        (default contain)
 *
 * Each dropped dot fires a "globe:dot" event on the element with
 * detail { lat, lon } in degrees.
 *
 * Respects prefers-reduced-motion (draws one still frame) and stops
 * animating while the section is off screen.
 *
 * JS API (optional): PlatesGlobe.init(el), PlatesGlobe.initAll(root),
 *   instance.refresh() after changing attributes, instance.clearDots(),
 *   instance.destroy().
 */
(function () {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';
  var TAU = Math.PI * 2;
  var R = 49;                 // globe radius in SVG units (viewBox is 100 tall)
  var MERIDIAN_STEPS = 48;    // samples per half meridian
  var RING_STEPS = 96;        // samples per ring
  var reduceMotion = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;

  function attr(el, name, fallback) {
    var v = parseFloat(el.getAttribute('data-globe-' + name));
    return isFinite(v) ? v : fallback;
  }

  function fmt(n) { return Math.round(n * 100) / 100; }

  // Collects line segments into a "front" and a "back" path string,
  // cutting a line exactly where it crosses over the edge of the globe.
  function Splitter() { this.front = ''; this.back = ''; }
  Splitter.prototype.line = function (pts) {
    // pts: flat array [x, y, z, x, y, z, ...] in screen space, z > 0 faces viewer
    var n = pts.length / 3, i, x0, y0, z0, x1, y1, z1, t, cx, cy;
    x0 = pts[0]; y0 = pts[1]; z0 = pts[2];
    var side = z0 >= 0, d = 'M' + fmt(x0) + ' ' + fmt(y0);
    for (i = 1; i < n; i++) {
      x1 = pts[i * 3]; y1 = pts[i * 3 + 1]; z1 = pts[i * 3 + 2];
      if ((z1 >= 0) !== side) {
        t = z0 / (z0 - z1);
        cx = x0 + (x1 - x0) * t; cy = y0 + (y1 - y0) * t;
        d += 'L' + fmt(cx) + ' ' + fmt(cy);
        if (side) this.front += d; else this.back += d;
        side = !side;
        d = 'M' + fmt(cx) + ' ' + fmt(cy);
      }
      d += 'L' + fmt(x1) + ' ' + fmt(y1);
      x0 = x1; y0 = y1; z0 = z1;
    }
    if (side) this.front += d; else this.back += d;
  };

  function Globe(el) {
    this.el = el;
    this.time = 0;
    this.last = 0;
    this.visible = true;
    this.raf = 0;
    this.tick = this.tick.bind(this);
    this.onMotionPref = this.sync.bind(this);
    this.yaw = 0; this.pitch = 0; this.tx = 0; this.ty = 0;
    var me = this;
    // Mouse position relative to the globe's centre, -1..1, measured against the viewport.
    this.onPointer = function (e) {
      if (e.pointerType === 'touch') return;
      var r = me.el.getBoundingClientRect();
      var hw = Math.max(1, window.innerWidth / 2), hh = Math.max(1, window.innerHeight / 2);
      me.tx = Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width / 2)) / hw));
      me.ty = Math.max(-1, Math.min(1, (e.clientY - (r.top + r.height / 2)) / hh));
    };
    // Drift back to centre when the mouse leaves the window.
    this.onLeave = function (e) { if (!e.relatedTarget) { me.tx = 0; me.ty = 0; } };
    window.addEventListener('pointermove', this.onPointer, { passive: true });
    document.addEventListener('mouseout', this.onLeave);

    // Click/tap on the globe: find the front-surface point under the pointer and
    // undo the current tilt and spin, so the dot is pinned to the globe itself.
    this.dots = [];
    this.onClick = function (e) {
      if (!me.o.dots || !me.svg) return;
      if (e.target.closest && e.target.closest('a,button,input,select,textarea,label,[contenteditable]')) return;
      var m = me.svg.getScreenCTM(); if (!m) return;
      var p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
      var x = p.x / me.rx, ys = -p.y / R, q = x * x + ys * ys;
      if (q > 1) return;
      var d = Math.sqrt(1 - q);
      var py = ys * me.ct + d * me.st, Z = -ys * me.st + d * me.ct;
      var px = x * me.cr - Z * me.sr, pz = x * me.sr + Z * me.cr;
      me.dots.push([px, py, pz]);
      while (me.dots.length > me.o.dots) me.dots.shift();
      me.draw();
      var ev;
      try { ev = new CustomEvent('globe:dot', { detail: { lat: Math.asin(Math.max(-1, Math.min(1, py))) * 180 / Math.PI, lon: Math.atan2(px, pz) * 180 / Math.PI } }); } catch (err) {}
      if (ev) me.el.dispatchEvent(ev);
    };
    document.addEventListener('click', this.onClick);
    this.build();
    this.refresh();

    var self = this;
    if ('IntersectionObserver' in window) {
      this.io = new IntersectionObserver(function (entries) {
        self.visible = entries[entries.length - 1].isIntersecting;
        self.sync();
      }, { rootMargin: '100px' });
      this.io.observe(el);
    }
    if (reduceMotion) {
      if (reduceMotion.addEventListener) reduceMotion.addEventListener('change', this.onMotionPref);
      else if (reduceMotion.addListener) reduceMotion.addListener(this.onMotionPref);
    }
  }

  Globe.prototype.build = function () {
    var el = this.el;
    el.setAttribute('aria-hidden', 'true');
    if (getComputedStyle(el).position === 'static') {
      el.style.position = 'absolute';
      el.style.inset = '0';
    }
    el.style.pointerEvents = 'none';

    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('focusable', 'false');
    svg.style.cssText = 'display:block;width:100%;height:100%;overflow:visible';

    var g = document.createElementNS(NS, 'g');
    g.setAttribute('fill', 'none');
    g.setAttribute('stroke', 'currentColor');
    g.setAttribute('stroke-linecap', 'round');
    g.setAttribute('stroke-linejoin', 'round');

    function path() {
      var p = document.createElementNS(NS, 'path');
      p.setAttribute('vector-effect', 'non-scaling-stroke');
      g.appendChild(p);
      return p;
    }
    this.backPath = path();
    this.frontPath = path();
    this.staticPath = path();
    this.outline = document.createElementNS(NS, 'ellipse');
    this.outline.setAttribute('vector-effect', 'non-scaling-stroke');
    g.appendChild(this.outline);

    // Dots sit outside the line group so line opacity does not dim them.
    // Each dot is a near-zero-length round-capped stroke. Unlike the lines, the
    // stroke scales with the SVG, so dots keep their size relative to the globe.
    function dotPath() {
      var p = document.createElementNS(NS, 'path');
      p.setAttribute('fill', 'none');
      p.setAttribute('stroke-linecap', 'round');
      return p;
    }
    this.backDots = dotPath();
    this.frontDots = dotPath();

    svg.appendChild(this.backDots);
    svg.appendChild(g);
    svg.appendChild(this.frontDots);
    el.appendChild(svg);
    this.svg = svg;
    this.g = g;
  };

  // Re-read the data attributes. Call after changing them.
  Globe.prototype.refresh = function () {
    var el = this.el;
    var style = el.getAttribute('data-globe-style');
    this.o = {
      style: style === 'lens' ? 'lens' : 'parallels',
      meridians: Math.max(2, Math.round(attr(el, 'meridians', 24))),
      rings: Math.max(0, Math.round(attr(el, 'rings', 9))),
      period: Math.max(1, attr(el, 'period', 45)),
      direction: attr(el, 'direction', 1) < 0 ? -1 : 1,
      tilt: attr(el, 'tilt', 0) * Math.PI / 180,
      aspect: Math.max(0.2, attr(el, 'aspect', 2.2)),
      back: Math.min(1, Math.max(0, attr(el, 'back', 0.4))),
      stroke: Math.max(0.1, attr(el, 'stroke', 1)),
      follow: Math.max(0, attr(el, 'follow', 24)) * Math.PI / 180,
      ease: Math.min(1, Math.max(0.01, attr(el, 'ease', 0.06))),
      opacity: Math.min(1, Math.max(0, attr(el, 'opacity', 0.28))),
      dots: Math.max(0, Math.round(attr(el, 'dots', 100))),
      dotSize: Math.max(0.5, attr(el, 'dot-size', 12)),
      dotRef: Math.max(1, attr(el, 'dot-ref', 1000)),
      dotColor: el.getAttribute('data-globe-dot-color') || '#FF3EB5',
      fit: el.getAttribute('data-globe-fit') === 'cover' ? 'cover' : 'contain'
    };
    var o = this.o, rx = R * o.aspect, pad = 1;
    this.rx = rx;

    this.svg.setAttribute('viewBox', [-(rx + pad), -(R + pad), 2 * (rx + pad), 2 * (R + pad)].join(' '));
    this.svg.setAttribute('preserveAspectRatio', o.fit === 'cover' ? 'xMidYMid slice' : 'xMidYMid meet');
    this.g.setAttribute('stroke-width', o.stroke);
    this.backPath.setAttribute('opacity', o.back);
    this.g.setAttribute('opacity', o.opacity);
    // Dot size is set in globe units (the globe is 2 * rx units wide), so dots
    // scale with the globe: dot-size px at a dot-ref px wide globe.
    var dotUnits = o.dotSize * (2 * rx) / o.dotRef;
    [this.backDots, this.frontDots].forEach(function (p) {
      p.setAttribute('stroke', o.dotColor);
      p.setAttribute('stroke-width', fmt(dotUnits * 1000) / 1000);
    });
    this.backDots.setAttribute('opacity', o.back);
    while (this.dots.length > o.dots) this.dots.shift();
    this.outline.setAttribute('cx', 0);
    this.outline.setAttribute('cy', 0);
    this.outline.setAttribute('rx', fmt(rx));
    this.outline.setAttribute('ry', R);

    // "lens" rings are fixed to the camera, so they are drawn once.
    var d = '';
    if (o.style === 'lens') {
      for (var k = 1; k <= o.rings; k++) {
        var f = -1 + (2 * k) / (o.rings + 1);  // height of the ring at the centre, -1..1
        for (var i = 0; i <= RING_STEPS; i++) {
          var u = Math.PI * i / RING_STEPS;
          d += (i ? 'L' : 'M') + fmt(-Math.cos(u) * rx) + ' ' + fmt(-Math.sin(u) * f * R);
        }
      }
    }
    this.staticPath.setAttribute('d', d);

    this.draw();
    this.sync();
  };

  Globe.prototype.draw = function () {
    var o = this.o, rx = this.rx;
    var rot = o.direction * TAU * (this.time / o.period) + this.yaw;
    var tilt = o.tilt + this.pitch;
    var cr = Math.cos(rot), sr = Math.sin(rot);
    var ct = Math.cos(tilt), st = Math.sin(tilt);
    this.cr = cr; this.sr = sr; this.ct = ct; this.st = st;
    var out = new Splitter();
    var pts, i, k, x, y, z, X, Z;

    // Unit sphere point -> rotate about the vertical axis -> tilt toward camera -> screen
    function push(arr, idx, px, py, pz) {
      X = px * cr + pz * sr;
      Z = -px * sr + pz * cr;
      arr[idx] = X * rx;
      arr[idx + 1] = -(py * ct - Z * st) * R;
      arr[idx + 2] = py * st + Z * ct;
    }

    // Meridians: half circles from pole to pole, evenly spaced around the globe.
    pts = new Array((MERIDIAN_STEPS + 1) * 3);
    for (k = 0; k < o.meridians; k++) {
      var lon = TAU * k / o.meridians, sl = Math.sin(lon), cl = Math.cos(lon);
      for (i = 0; i <= MERIDIAN_STEPS; i++) {
        var lat = -Math.PI / 2 + Math.PI * i / MERIDIAN_STEPS;
        var c = Math.cos(lat);
        push(pts, i * 3, c * sl, Math.sin(lat), c * cl);
      }
      out.line(pts);
    }

    // Parallels: true latitude circles, carried by the same rotation and tilt.
    if (o.style === 'parallels') {
      pts = new Array((RING_STEPS + 1) * 3);
      for (k = 1; k <= o.rings; k++) {
        var la = -Math.PI / 2 + Math.PI * k / (o.rings + 1);
        var cy = Math.sin(la), r = Math.cos(la);
        for (i = 0; i <= RING_STEPS; i++) {
          var a = TAU * i / RING_STEPS;
          push(pts, i * 3, r * Math.sin(a), cy, r * Math.cos(a));
        }
        out.line(pts);
      }
    }

    this.frontPath.setAttribute('d', out.front);
    this.backPath.setAttribute('d', out.back);

    // Dots: same transform as the lines; far-side dots are dimmed like far-side lines.
    var df = '', db = '', dp = [0, 0, 0];
    for (k = 0; k < this.dots.length; k++) {
      var q = this.dots[k];
      push(dp, 0, q[0], q[1], q[2]);
      var s = 'M' + fmt(dp[0]) + ' ' + fmt(dp[1]) + 'h0.01';
      if (dp[2] >= 0) df += s; else db += s;
    }
    this.frontDots.setAttribute('d', df);
    this.backDots.setAttribute('d', db);
  };

  Globe.prototype.clearDots = function () {
    this.dots = [];
    this.draw();
  };

  Globe.prototype.shouldRun = function () {
    return this.visible && !(reduceMotion && reduceMotion.matches) && !this.destroyed;
  };

  Globe.prototype.sync = function () {
    if (this.shouldRun()) {
      if (!this.raf) { this.last = 0; this.raf = requestAnimationFrame(this.tick); }
    } else if (this.raf) {
      cancelAnimationFrame(this.raf);
      this.raf = 0;
    }
  };

  Globe.prototype.tick = function (now) {
    // Clamp the step so returning to a background tab does not jump.
    var dt = this.last ? Math.min(0.1, (now - this.last) / 1000) : 0;
    this.time += dt;
    this.last = now;
    // Ease toward the mouse; frame-rate independent.
    var o = this.o, k = 1 - Math.pow(1 - o.ease, dt * 60);
    this.yaw += (this.tx * o.follow - this.yaw) * k;
    this.pitch += (-this.ty * o.follow - this.pitch) * k;
    this.draw();
    this.raf = requestAnimationFrame(this.tick);
  };

  Globe.prototype.destroy = function () {
    this.destroyed = true;
    this.sync();
    if (this.io) this.io.disconnect();
    window.removeEventListener('pointermove', this.onPointer);
    document.removeEventListener('mouseout', this.onLeave);
    document.removeEventListener('click', this.onClick);
    if (reduceMotion) {
      if (reduceMotion.removeEventListener) reduceMotion.removeEventListener('change', this.onMotionPref);
      else if (reduceMotion.removeListener) reduceMotion.removeListener(this.onMotionPref);
    }
    if (this.svg.parentNode) this.svg.parentNode.removeChild(this.svg);
    delete this.el.__globe;
  };

  var api = {
    init: function (el) {
      if (!el.__globe) el.__globe = new Globe(el);
      return el.__globe;
    },
    initAll: function (root) {
      var list = (root || document).querySelectorAll('[data-globe]');
      for (var i = 0; i < list.length; i++) api.init(list[i]);
    }
  };
  window.PlatesGlobe = api;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { api.initAll(); });
  } else {
    api.initAll();
  }
})();
