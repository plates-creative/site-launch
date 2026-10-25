/*!
 * goo-text.js — accessible gooey hover type
 *
 * The heading stays a real heading. Its text is never removed or
 * replaced, so screen readers, search/answer engines, text selection,
 * find-in-page and translation tools all see normal text. Only the
 * glyph *fill* is made transparent, and a WebGL canvas layered on top
 * draws the goo. The canvas re-draws the text from the heading's live
 * layout (line breaks, positions, computed font), so wrapping,
 * responsive sizes and web fonts are picked up automatically.
 *
 * The goo itself is a port of Sarah's Merge engine: a Gaussian blur
 * pyramid of the text, blended per pixel by distance from the pointer,
 * then thresholded once. That per-pixel blend is what makes it fluid.
 *
 * USAGE
 *   <h2 data-goo="reveal">We help brands see themselves clearly…</h2>
 *   <h2 data-goo="melt">…</h2>
 *   then load goo-text.js once per page (defer is fine); it auto-initialises
 *
 *   reveal — blobby at rest, resolves to crisp type under the pointer
 *   melt   — crisp at rest, melts under the pointer
 *
 * OPTIONAL TUNING (data attributes; sizes are in em of the heading)
 *   data-goo-spread="0.28"     how far letters blob out
 *   data-goo-threshold="0.32"  0–1, lower = fatter blobs that merge sooner
 *   data-goo-radius="1.6"      size of the pointer zone
 *   data-goo-feather="0.55"    0–1, softness of the pointer zone's edge
 *   data-goo-follow="0.09"     0–1, how quickly the zone chases the cursor
 *   data-goo-fade="0.07"       0–1, how quickly the effect eases in and out
 *                              when the cursor enters or leaves
 *   data-goo-edge="1"          blob edge softness
 *   data-goo-color="#ff3eb5"   default: the heading's own CSS color
 *
 * PER-PART SETTINGS (Plates edit)
 *   Any element INSIDE a goo element can carry its own data-goo-radius,
 *   -feather, -threshold or -spread. They apply over that element's area
 *   (radius/spread in em of that element), everything else uses the goo
 *   element's own settings. Still one canvas / one WebGL context.
 *     <div data-goo="melt" data-goo-radius="6.4">
 *       <h2>Title</h2>
 *       <p data-goo-radius="6.8" data-goo-feather="1">Description…</p>
 *     </div>
 *
 * TOUCH SCREENS (Plates edit): there's no cursor, so "reveal" elements
 * play once as an intro instead: blobby type resolves left to right
 * (Sarah's "First contact" sweep) as the element scrolls into view, then
 * the canvas is removed and the plain text remains. "melt" elements stay
 * plain text on touch.
 *   data-goo-intro="1.8"       intro length in seconds; "off" disables it
 *
 * FALLS BACK TO PLAIN TEXT (no effect) when: WebGL is unavailable,
 * forced-colors / high-contrast mode is on, or the user prefers reduced
 * motion. Nothing is hidden until the
 * effect has successfully drawn its first frame.
 *
 * JS API (optional): GooText.init(el, opts) -> { refresh(), destroy() }
 *                    GooText.initAll(root)
 */
(function (global) {
  "use strict";

  var DEFAULTS = {
    mode: "reveal",
    spread: 0.28,
    threshold: 0.32,
    radius: 1.6,
    feather: 0.55,
    follow: 0.09,
    fade: 0.07,
    edge: 1,
    color: null,
    respectReducedMotion: true
  };
  var MAX_LEVELS = 7;   // blur levels on top of the sharp one (8 samplers total)
  var DPR_CAP = 2;

  /* ------------------------------------------------------------------ */
  /* shared CSS                                                          */
  /* ------------------------------------------------------------------ */
  function injectCSS() {
    if (document.getElementById("goo-text-css")) return;
    var s = document.createElement("style");
    s.id = "goo-text-css";
    s.textContent =
      ".goo-text>.goo-canvas{position:absolute;display:block;pointer-events:none;" +
      "opacity:0;transition:opacity .35s ease}" +
      ".goo-text.goo-on{-webkit-text-fill-color:transparent}" +
      ".goo-text.goo-on>.goo-canvas{opacity:1}";
    document.head.appendChild(s);
  }

  function mq(q) { return !!(global.matchMedia && global.matchMedia(q).matches); }
  function effectAllowed(o) {
    if (mq("(hover: none)") && !o.intro) return false;   // touch: intro only
    if (mq("(forced-colors: active)")) return false;
    if (o.respectReducedMotion && mq("(prefers-reduced-motion: reduce)")) return false;
    return true;
  }

  function readOptions(el, user) {
    var o = {}, k;
    for (k in DEFAULTS) o[k] = DEFAULTS[k];
    var d = el.dataset || {};
    if (d.goo) o.mode = d.goo;
    var nums = ["spread", "threshold", "radius", "feather", "follow", "fade", "edge"];
    nums.forEach(function (n) {
      var key = "goo" + n.charAt(0).toUpperCase() + n.slice(1);
      if (d[key] !== undefined && d[key] !== "" && !isNaN(parseFloat(d[key]))) o[n] = parseFloat(d[key]);
    });
    if (d.gooColor) o.color = d.gooColor;
    if (user) for (k in user) if (user[k] !== undefined) o[k] = user[k];
    o.mode = (o.mode === "melt" || o.mode === "disturb") ? "melt" : "reveal";
    // Plates edit: touch screens get a one-time intro on "reveal" elements
    o.intro = mq("(hover: none)") && o.mode === "reveal" && d.gooIntro !== "off";
    o.introDuration = (d.gooIntro && !isNaN(parseFloat(d.gooIntro))) ? parseFloat(d.gooIntro) : 1.8;
    return o;
  }

  /* ------------------------------------------------------------------ */
  /* shaders                                                             */
  /* ------------------------------------------------------------------ */
  var VS = "attribute vec2 a;varying vec2 v;void main(){v=a*0.5+0.5;gl_Position=vec4(a,0.0,1.0);}";

  var FS_FIELD =
    "precision highp float;varying vec2 v;uniform sampler2D uTex;" +
    "void main(){float a=texture2D(uTex,v).a;gl_FragColor=vec4(a,a,a,1.0);}";

  var FS_DOWN =
    "precision highp float;varying vec2 v;uniform sampler2D uTex;uniform vec2 uTexel;" +
    "void main(){float s=0.0;" +
    "s+=texture2D(uTex,v+uTexel*vec2(-0.5,-0.5)).r;" +
    "s+=texture2D(uTex,v+uTexel*vec2( 0.5,-0.5)).r;" +
    "s+=texture2D(uTex,v+uTexel*vec2(-0.5, 0.5)).r;" +
    "s+=texture2D(uTex,v+uTexel*vec2( 0.5, 0.5)).r;" +
    "s*=0.25;gl_FragColor=vec4(s,s,s,1.0);}";

  // 17 taps spanning +-3 sigma. Each pyramid level is stored at a resolution
  // where its blur is only a few texels wide, so the taps stay dense enough
  // to give round blob ends instead of pointed or faceted ones.
  var FS_BLUR =
    "precision highp float;varying vec2 v;uniform sampler2D uTex;" +
    "uniform vec2 uTexel;uniform vec2 uDir;uniform float uSigma;" +
    "void main(){float s=max(uSigma,0.0001);float st=s*0.375;float acc=0.0,wsum=0.0;" +
    "for(int i=-8;i<=8;i++){float fi=float(i)*st;float w=exp(-0.5*fi*fi/(s*s));" +
    "acc+=texture2D(uTex,v+uDir*uTexel*fi).r*w;wsum+=w;}" +
    "float o=acc/wsum;gl_FragColor=vec4(o,o,o,1.0);}";

  // Plates edit: per-pixel settings. uParams is a low-res map painted while
  // rasterising: R = radius (x uRadMax), G = feather, B = threshold,
  // A = spread (x uSpreadMax). Lets parts of one goo element (e.g. a title
  // and its description) carry their own settings inside a single layer.
  // nLvl = number of blur levels the GPU has texture slots for.
  function compositeFS(deriv, nLvl) {
    var i, decl = "uniform sampler2D uL0", lvl = "float lvl(int i,vec2 p){ if(i<=0)return texture2D(uL0,p).r;";
    for (i = 1; i <= nLvl; i++) decl += ",uL" + i;
    for (i = 1; i < nLvl; i++) lvl += "if(i==" + i + ")return texture2D(uL" + i + ",p).r;";
    lvl += "return texture2D(uL" + nLvl + ",p).r;}";
    return (deriv ? "#extension GL_OES_standard_derivatives : enable\n" : "") +
      "precision highp float;varying vec2 v;" +
      decl + ";uniform sampler2D uParams;" +
      "uniform vec2 uRes,uPtr;" +
      "uniform float uPresence,uEdge,uRadMax,uSpreadMax,uMaxLevel,uSweep,uFront;" +
      "uniform int uMode;uniform vec4 uColor;" +
      lvl +
      // blur radius in px -> fractional pyramid level, blended between the two nearest
      "float varBlur(float s,vec2 p){" +
      " float f=(s<=1.5)?s/1.5:1.0+log2(s/1.5);" +
      " f=clamp(f,0.0,uMaxLevel);float fl=floor(f);int i0=int(fl);" +
      " if(fl>=uMaxLevel)return lvl(i0,p);" +
      " return mix(lvl(i0,p),lvl(i0+1,p),f-fl);}" +
      "void main(){" +
      " vec4 P=texture2D(uParams,v);" +
      " float rad=max(P.r*uRadMax,1.0),fea=clamp(P.g,0.01,1.0),thr=P.b,spr=P.a*uSpreadMax;" +
      // distance to the (eased) pointer, in device px — so the zone is a true circle at any size
      " float d=length(v*uRes-uPtr);" +
      " float g=smoothstep(rad*(1.0-fea),rad*(1.0+fea),d);" +
      " float nearP=(1.0-g)*uPresence;" +
      " float f=(uMode==0)?(1.0-nearP):nearP;" +
      // Plates edit: intro sweep (touch). uSweep 0..1 resolves the type left to
      // right with a soft front; < 0 means no intro (pointer-driven as usual).
      " if(uSweep>-0.5){float loc=clamp((uSweep*(1.0+uFront)-v.x)/uFront,0.0,1.0);f*=1.0-loc;}" +
      " float sBlur=spr*f;" +
      " float field=varBlur(sBlur,v);" +
      (deriv
        ? " float w=max(fwidth(field)*(0.5+uEdge),1e-4);"
        : " float w=0.02*(0.5+uEdge);") +
      " float m=smoothstep(thr-w,thr+w,field);" +
      // Plates edit: where there's (almost) no blur, use the browser's own
      // anti-aliased text coverage instead of thresholding it, so crisp type
      // matches native text exactly. Hand over to the goo threshold across the
      // first 1.5 device px of blur, which is invisible inside the zone's feather.
      " float raw=texture2D(uL0,v).r;" +
      " float k=smoothstep(0.0,1.5,sBlur);" +
      " float a=uColor.a*mix(raw,m,k);" +
      " gl_FragColor=vec4(uColor.rgb*a,a);}";
  }

  /* ------------------------------------------------------------------ */
  /* helpers                                                             */
  /* ------------------------------------------------------------------ */
  var colorProbe = null;
  function parseColor(str) {
    if (!colorProbe) colorProbe = document.createElement("canvas").getContext("2d");
    colorProbe.fillStyle = "#000";
    colorProbe.fillStyle = str;
    var c = colorProbe.fillStyle, m;
    if (c.charAt(0) === "#") {
      var n = parseInt(c.slice(1), 16);
      return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, 1];
    }
    m = c.match(/[\d.]+/g);
    if (!m) return [0, 0, 0, 1];
    return [m[0] / 255, m[1] / 255, m[2] / 255, m[3] !== undefined ? +m[3] : 1];
  }

  function applyTransform(str, tt, isWordStart) {
    if (tt === "uppercase") return str.toUpperCase();
    if (tt === "lowercase") return str.toLowerCase();
    if (tt === "capitalize" && isWordStart) return str.charAt(0).toUpperCase() + str.slice(1);
    return str;
  }

  /* ------------------------------------------------------------------ */
  /* instance                                                            */
  /* ------------------------------------------------------------------ */
  var instances = [];

  function init(host, userOpts) {
    if (!host) return null;
    if (host.__goo) return host.__goo;
    var o = readOptions(host, userOpts);
    if (!effectAllowed(o)) return null;

    var canvas = document.createElement("canvas");
    var gl = canvas.getContext("webgl", {
      alpha: true, premultipliedAlpha: true, antialias: false,
      depth: false, stencil: false, preserveDrawingBuffer: false
    });
    if (!gl) return null;

    injectCSS();
    canvas.className = "goo-canvas";
    canvas.setAttribute("aria-hidden", "true");
    canvas.setAttribute("role", "presentation");
    if (getComputedStyle(host).position === "static") host.style.position = "relative";
    host.classList.add("goo-text");
    host.appendChild(canvas);

    /* ---- GL programs ---- */
    var deriv = gl.getExtension("OES_standard_derivatives");
    var quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);

    function compile(src, type) {
      var s = gl.createShader(type);
      gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    }
    function program(fs) {
      var p = gl.createProgram();
      gl.attachShader(p, compile(VS, gl.VERTEX_SHADER));
      gl.attachShader(p, compile(fs, gl.FRAGMENT_SHADER));
      gl.bindAttribLocation(p, 0, "a");
      gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
      var u = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
      for (var i = 0; i < n; i++) {
        var info = gl.getActiveUniform(p, i);
        u[info.name.replace(/\[0\]$/, "")] = gl.getUniformLocation(p, info.name);
      }
      return { p: p, u: u };
    }
    // L0 + blur levels + settings map must fit the GPU's texture slots (8 is the
    // WebGL minimum; most desktop GPUs have 16+). Fewer slots = fewer levels.
    var units = gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS) || 8;
    var LVL = Math.max(1, Math.min(MAX_LEVELS, units - 2));
    var pField, pDown, pBlur, pComp;
    try {
      pField = program(FS_FIELD); pDown = program(FS_DOWN);
      pBlur = program(FS_BLUR); pComp = program(compositeFS(!!deriv, LVL));
    } catch (err) {
      if (global.console) console.warn("goo-text: shader setup failed, leaving plain text.", err);
      canvas.remove(); host.classList.remove("goo-text");
      return null;
    }

    function makeTex() {
      var t = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return t;
    }
    // Store the blurred fields as half-floats where the GPU can render to
    // and filter them. 8-bit storage leaves faint stair-steps along the
    // edges of large blobs; half-floats make those edges clean. Falls back
    // to 8-bit automatically.
    var halfExt = gl.getExtension("OES_texture_half_float");
    var halfLinear = gl.getExtension("OES_texture_half_float_linear");
    gl.getExtension("EXT_color_buffer_half_float");
    var texType = (halfExt && halfLinear) ? halfExt.HALF_FLOAT_OES : gl.UNSIGNED_BYTE;

    function makeTarget(w, h) {
      var t = makeTex();
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, texType, null);
      var f = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, f);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
      if (texType !== gl.UNSIGNED_BYTE &&
          gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
        gl.deleteTexture(t); gl.deleteFramebuffer(f);
        texType = gl.UNSIGNED_BYTE;
        return makeTarget(w, h);
      }
      return { t: t, f: f, w: w, h: h };
    }
    function freeTarget(tg) { if (tg) { gl.deleteTexture(tg.t); gl.deleteFramebuffer(tg.f); } }

    var srcTex = makeTex();
    var paramTex = makeTex();
    var PDIV = 4;                         // settings map is stored at 1/4 resolution (smooth edges)
    var radMaxPx = 1, spreadMaxPx = 0, reachPx = 0;
    var full = null, half = null, levels = [], temps = [];

    // Level k blurs by 1.5 * 2^k device px. The first four live at half
    // resolution (as in Sarah's engine); the heavier ones drop resolution
    // with their blur so every level is ~6 texels wide in its own texture.
    // That keeps the blur accurately sampled at any type size, and the
    // lower-res storage smooths out 8-bit stair-stepping on big blobs.
    function levelDiv(k) { return Math.pow(2, Math.max(1, k - 2)); }

    function alloc() {
      freeTarget(full); freeTarget(half);
      levels.forEach(freeTarget); temps.forEach(freeTarget);
      full = makeTarget(W, H);
      half = makeTarget(Math.max(1, Math.round(W / 2)), Math.max(1, Math.round(H / 2)));
      levels = []; temps = [];
      for (var k = 0; k < LVL; k++) {
        var d = levelDiv(k);
        var lw = Math.max(1, Math.round(W / d)), lh = Math.max(1, Math.round(H / d));
        levels.push(makeTarget(lw, lh));
        temps.push(makeTarget(lw, lh));
      }
    }

    function bindQuad(prog) {
      gl.useProgram(prog.p);
      gl.bindBuffer(gl.ARRAY_BUFFER, quad);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    }
    function pass(target) {
      if (target) { gl.bindFramebuffer(gl.FRAMEBUFFER, target.f); gl.viewport(0, 0, target.w, target.h); }
      else { gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, W, H); }
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    function useTex(unit, tex, loc) {
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.uniform1i(loc, unit);
    }

    /* ---- state ---- */
    var W = 0, H = 0, dpr = 1, cssW = 0, cssH = 0, margin = 0;
    var spreadPx = 0, radPx = 0, nLevels = 1, color = [0, 0, 0, 1];
    var ready = false, destroyed = false, rasterQueued = false;
    var st = { tx: 0, ty: 0, cx: 0, cy: 0, p: 0, pt: 0, moving: false,
               sweep: o.intro ? 0 : -1, introGo: false, introT: 0 };

    var tc = document.createElement("canvas");
    var tctx = tc.getContext("2d");
    var range = document.createRange();

    /* ---- rasterise the live DOM text into the source texture ---- */
    function drawRun(str, rect, ox, oy) {
      var mt = tctx.measureText(str);
      var asc = mt.fontBoundingBoxAscent, desc = mt.fontBoundingBoxDescent;
      var x = rect.left - ox, y;
      if (asc !== undefined && desc !== undefined) {
        tctx.textBaseline = "alphabetic";
        y = rect.top - oy + (rect.height - (asc + desc)) / 2 + asc;
        // Plates edit: snap the baseline to a whole device pixel, as the
        // browser does for native text, so horizontal edges stay sharp
        y = Math.round(y * dpr) / dpr;
      } else {
        tctx.textBaseline = "middle";
        y = rect.top - oy + rect.height / 2;
      }
      // nudge the canvas run to the exact width the browser laid out, which
      // absorbs any small shaping differences between DOM and canvas text
      var sx = mt.width > 0 ? rect.width / mt.width : 1;
      if (!(sx > 0.85 && sx < 1.15)) sx = 1;
      tctx.save();
      tctx.translate(x, y);
      tctx.scale(sx, 1);
      tctx.fillText(str, 0, 0);
      tctx.restore();
    }

    function drawTextNodes(ox, oy) {
      var walker = document.createTreeWalker(host, NodeFilter.SHOW_TEXT, null);
      var hasLS = "letterSpacing" in tctx;
      var node;
      while ((node = walker.nextNode())) {
        var el = node.parentElement;
        if (!el || el.closest("[data-goo-skip]")) continue;
        var cs = getComputedStyle(el);
        if (cs.visibility === "hidden") continue;
        tctx.font = cs.fontStyle + " " + cs.fontWeight + " " + cs.fontSize + " " + cs.fontFamily;
        var ls = cs.letterSpacing === "normal" ? 0 : (parseFloat(cs.letterSpacing) || 0);
        if (hasLS) tctx.letterSpacing = ls + "px";
        if ("fontKerning" in tctx) tctx.fontKerning = cs.fontKerning === "none" ? "none" : "normal";
        var perCharOnly = ls !== 0 && !hasLS;
        var tt = cs.textTransform;
        var data = node.data, re = /\S+/g, m;
        while ((m = re.exec(data))) {
          var start = m.index, end = start + m[0].length;
          range.setStart(node, start); range.setEnd(node, end);
          var rects = range.getClientRects();
          if (!rects.length) continue;
          if (rects.length === 1 && !perCharOnly) {
            drawRun(applyTransform(m[0], tt, true), rects[0], ox, oy);
          } else {
            // word split across lines (hyphenation) or no canvas letter-spacing: go glyph by glyph
            for (var i = start; i < end;) {
              var cp = data.codePointAt(i), len = cp > 0xffff ? 2 : 1;
              range.setStart(node, i); range.setEnd(node, i + len);
              var r = range.getClientRects()[0];
              if (r) drawRun(applyTransform(data.substr(i, len), tt, i === start), r, ox, oy);
              i += len;
            }
          }
        }
      }
    }

    /* ---- Plates edit: per-part settings ----
       The element's own settings apply everywhere by default. Any descendant
       with its own data-goo-radius / -feather / -threshold / -spread overrides
       them over its own area (radius and spread in em of THAT element). */
    var OVERRIDE = "[data-goo-radius],[data-goo-feather],[data-goo-threshold],[data-goo-spread]";
    function num(v, def) { return (v !== undefined && v !== "" && !isNaN(parseFloat(v))) ? parseFloat(v) : def; }
    function collectSpecs(fontPx) {
      var base = { el: null, rad: o.radius * fontPx, feather: o.feather, threshold: o.threshold, spread: o.spread * fontPx };
      var list = [base];
      var els = host.querySelectorAll(OVERRIDE);
      for (var i = 0; i < els.length; i++) {
        var el = els[i];
        if (el.closest("[data-goo-skip]")) continue;
        var d = el.dataset, f = parseFloat(getComputedStyle(el).fontSize) || fontPx;
        list.push({
          el: el,
          rad: d.gooRadius !== undefined ? num(d.gooRadius, 0) * f : base.rad,
          feather: num(d.gooFeather, base.feather),
          threshold: num(d.gooThreshold, base.threshold),
          spread: d.gooSpread !== undefined ? num(d.gooSpread, 0) * f : base.spread
        });
      }
      return list;
    }
    function paintParams(specs, ox, oy) {
      var pw = Math.max(1, Math.ceil(W / PDIV)), ph = Math.max(1, Math.ceil(H / PDIV));
      var data = new Uint8Array(pw * ph * 4);
      var sx = (W / cssW) / PDIV, sy = (H / cssH) / PDIV;
      function enc(sp) {
        return [
          Math.round(255 * Math.min(1, (sp.rad * dpr) / radMaxPx)),
          Math.round(255 * Math.min(1, Math.max(0, sp.feather))),
          Math.round(255 * Math.min(1, Math.max(0, sp.threshold))),
          spreadMaxPx > 0 ? Math.round(255 * Math.min(1, (sp.spread * dpr) / spreadMaxPx)) : 0
        ];
      }
      function fill(x0, y0, x1, y1, c) {
        x0 = Math.max(0, Math.floor(x0)); y0 = Math.max(0, Math.floor(y0));
        x1 = Math.min(pw, Math.ceil(x1)); y1 = Math.min(ph, Math.ceil(y1));
        for (var y = y0; y < y1; y++) for (var x = x0; x < x1; x++) {
          var k = (y * pw + x) * 4; data[k] = c[0]; data[k + 1] = c[1]; data[k + 2] = c[2]; data[k + 3] = c[3];
        }
      }
      fill(0, 0, pw, ph, enc(specs[0]));
      for (var i = 1; i < specs.length; i++) {
        var sp = specs[i], b = sp.el.getBoundingClientRect();
        range.selectNodeContents(sp.el);
        var t = range.getBoundingClientRect();
        var pad = sp.spread * 1.5 + 2;            // room for this part's blobs
        var l = Math.min(b.left, t.left || b.left) - pad, tp = Math.min(b.top, t.top || b.top) - pad;
        var rt = Math.max(b.right, t.right) + pad, bt = Math.max(b.bottom, t.bottom) + pad;
        fill((l - ox) * sx, (tp - oy) * sy, (rt - ox) * sx, (bt - oy) * sy, enc(sp));
      }
      gl.bindTexture(gl.TEXTURE_2D, paramTex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, pw, ph, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
    }

    function rasterize() {
      rasterQueued = false;
      if (destroyed || gl.isContextLost()) return;
      var cs = getComputedStyle(host);
      var fontPx = parseFloat(cs.fontSize) || 16;
      dpr = Math.min(global.devicePixelRatio || 1, DPR_CAP);
      var specs = collectSpecs(fontPx);
      var radMaxCss = 0, spreadMaxCss = 0, reachCss = 0;
      specs.forEach(function (sp) {
        radMaxCss = Math.max(radMaxCss, sp.rad);
        spreadMaxCss = Math.max(spreadMaxCss, sp.spread);
        reachCss = Math.max(reachCss, sp.rad * (1 + sp.feather));
      });
      margin = Math.ceil(spreadMaxCss * 1.5 + 2);

      var r = host.getBoundingClientRect();
      // Plates edit: cover the text itself as well as the element's box. Text
      // can poke out of its box (accents, ascenders, trimmed line boxes), and
      // would otherwise be clipped at the canvas edge.
      var L = r.left, T = r.top, R = r.right, B = r.bottom;
      var tw = document.createTreeWalker(host, NodeFilter.SHOW_TEXT, null), tn;
      while ((tn = tw.nextNode())) {
        if (!tn.data.trim() || (tn.parentElement && tn.parentElement.closest("[data-goo-skip]"))) continue;
        range.selectNodeContents(tn);
        var tb = range.getBoundingClientRect();
        if (!tb.width && !tb.height) continue;
        L = Math.min(L, tb.left); T = Math.min(T, tb.top);
        R = Math.max(R, tb.right); B = Math.max(B, tb.bottom);
      }
      var offX = L - r.left, offY = T - r.top;   // <= 0
      cssW = (R - L) + margin * 2;
      cssH = (B - T) + margin * 2;
      // Plates edit: align the canvas to the device pixel grid. Otherwise a
      // heading at a fractional position makes the browser resample the whole
      // canvas, which softens every edge slightly.
      var docX = (L + (global.scrollX || 0) - margin) * dpr;
      var docY = (T + (global.scrollY || 0) - margin) * dpr;
      var fracX = (docX - Math.round(docX)) / dpr, fracY = (docY - Math.round(docY)) / dpr;
      canvas.style.left = (offX - margin - host.clientLeft - fracX) + "px";
      canvas.style.top = (offY - margin - host.clientTop - fracY) + "px";
      canvas.style.width = cssW + "px";
      canvas.style.height = cssH + "px";

      var w = Math.max(2, Math.round(cssW * dpr)), h = Math.max(2, Math.round(cssH * dpr));
      if (w !== W || h !== H) { W = w; H = h; canvas.width = W; canvas.height = H; alloc(); }

      spreadPx = spreadMaxCss * dpr;
      radPx = radMaxCss * dpr;
      spreadMaxPx = spreadPx; radMaxPx = Math.max(radPx, 1); reachPx = reachCss * dpr;
      nLevels = Math.min(LVL, Math.max(1, Math.ceil(1 + Math.log(Math.max(spreadPx, 1.5) / 1.5) / Math.LN2)));
      color = parseColor(o.color || cs.color);

      tc.width = W; tc.height = H;
      tctx.setTransform(W / cssW, 0, 0, H / cssH, 0, 0);
      tctx.clearRect(0, 0, cssW, cssH);
      tctx.fillStyle = "#fff";
      tctx.textAlign = "left";
      drawTextNodes(L - margin - fracX, T - margin - fracY);

      gl.bindTexture(gl.TEXTURE_2D, srcTex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, tc);

      paintParams(specs, L - margin - fracX, T - margin - fracY);

      buildPyramid();
      render();
      if (!ready) { ready = true; host.classList.add("goo-on"); if (st.introGo) startIntro(); }
    }

    // Plates edit: touch intro. Starts when the element scrolls into view (same
    // point as the scroll reveal fade) and once the first frame is drawn.
    function startIntro() {
      if (!o.intro || !ready || st.introT > 0 || st.moving) return;
      st.moving = true;
      wake();
    }

    function buildPyramid() {
      bindQuad(pField);
      useTex(0, srcTex, pField.u.uTex);
      pass(full);

      bindQuad(pDown);
      useTex(0, full.t, pDown.u.uTex);
      gl.uniform2f(pDown.u.uTexel, 1 / W, 1 / H);
      pass(half);

      // full-res sigmas 1.5, 3, 6, 12, 24, 48, 96 — each computed in the
      // texel units of the level it's stored in
      var src = half, srcDiv = 2, prevSig = 0;
      for (var k = 0; k < nLevels; k++) {
        var d = levelDiv(k), lv = levels[k], tmp = temps[k];
        var input = src;
        if (d > srcDiv) {
          // halve resolution first (2x2 box), then blur at the new size
          bindQuad(pDown);
          useTex(0, src.t, pDown.u.uTex);
          gl.uniform2f(pDown.u.uTexel, 1 / src.w, 1 / src.h);
          pass(lv);
          input = lv;
        }
        var sig = 1.5 * Math.pow(2, k);
        var delta = Math.sqrt(Math.max(sig * sig - prevSig * prevSig, 0.0001)) / d;
        bindQuad(pBlur);
        gl.uniform1f(pBlur.u.uSigma, delta);
        gl.uniform2f(pBlur.u.uTexel, 1 / lv.w, 1 / lv.h);
        useTex(0, input.t, pBlur.u.uTex);
        gl.uniform2f(pBlur.u.uDir, 1, 0);
        pass(tmp);
        useTex(0, tmp.t, pBlur.u.uTex);
        gl.uniform2f(pBlur.u.uDir, 0, 1);
        pass(lv);
        src = lv; srcDiv = d; prevSig = sig;
      }
    }

    function render() {
      if (!full || gl.isContextLost()) return;
      bindQuad(pComp);
      var u = pComp.u;
      useTex(0, full.t, u.uL0);
      for (var i = 0; i < LVL; i++) useTex(i + 1, levels[Math.min(i, nLevels - 1)].t, u["uL" + (i + 1)]);
      useTex(LVL + 1, paramTex, u.uParams);
      gl.uniform1f(u.uRadMax, radMaxPx);
      gl.uniform1f(u.uSpreadMax, spreadMaxPx);
      gl.uniform2f(u.uRes, W, H);
      gl.uniform2f(u.uPtr, st.cx, st.cy);
      gl.uniform1f(u.uPresence, st.p);
      gl.uniform1f(u.uSweep, st.sweep);
      gl.uniform1f(u.uFront, 0.6);
      gl.uniform1f(u.uEdge, o.edge);
      gl.uniform1f(u.uMaxLevel, nLevels);
      gl.uniform1i(u.uMode, o.mode === "melt" ? 1 : 0);
      gl.uniform4f(u.uColor, color[0], color[1], color[2], color[3]);
      pass(null);
    }

    function queueRaster() {
      if (rasterQueued || destroyed) return;
      rasterQueued = true;
      requestAnimationFrame(rasterize);
    }

    /* ---- pointer ---- */
    var inst = {
      el: host,
      options: o,
      precision: function () { return texType === gl.UNSIGNED_BYTE ? "8-bit" : "half-float"; },
      track: function (cx, cy, present) {
        if (!ready || o.intro) return;
        var r = canvas.getBoundingClientRect();
        var x = cx - r.left, y = cy - r.top;
        // Plates edit: wake the effect as soon as the outer (feathered) edge of
        // the pointer zone touches the text, not only once the cursor is over it.
        // Larger radius/feather values therefore start the effect from further away.
        var reach = reachPx * (r.width / W);   // largest zone of any part
        var dx = Math.max(-x, 0, x - r.width), dy = Math.max(-y, 0, y - r.height);
        // Plates edit: an element scrolled off screen can't show the effect, so
        // it never counts as in reach (large radii can otherwise reach it).
        var onScreen = r.bottom > 0 && r.top < global.innerHeight && r.right > 0 && r.left < global.innerWidth;
        var inside = present && onScreen && (dx * dx + dy * dy) <= reach * reach;
        // Plates edit: if the cursor is out of reach and the effect is already
        // fully at rest, there's nothing to draw, so don't wake this instance.
        // Keeps cursor movement cheap with many goo elements on a page.
        if (!inside && st.pt === 0 && st.p === 0 && !st.moving) return;
        st.tx = x * (W / r.width);
        st.ty = (r.height - y) * (H / r.height);
        if (inside && st.p < 0.02) { st.cx = st.tx; st.cy = st.ty; } // enter in place, don't fly in
        st.pt = inside ? 1 : 0;
        if (!st.moving) { st.moving = true; wake(); }
      },
      step: function (dt) {
        // Plates edit: the shared loop steps every instance each frame; one
        // that is already at rest has nothing new to draw, so skip it.
        if (!st.moving) return false;
        if (o.intro) {
          st.introT += dt;
          var t = Math.min(1, st.introT / o.introDuration);
          st.sweep = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;   // ease in-out
          render();
          if (t >= 1) {
            // fully resolved = identical to the plain text: hand back to it
            st.moving = false;
            setTimeout(function () { inst.destroy(); }, 60);
          }
          return st.moving;
        }
        var k = 1 - Math.pow(1 - o.follow, dt * 60);
        var kp = 1 - Math.pow(1 - o.fade, dt * 60);
        st.cx += (st.tx - st.cx) * k;
        st.cy += (st.ty - st.cy) * k;
        st.p += (st.pt - st.p) * kp;
        var settled = Math.abs(st.tx - st.cx) + Math.abs(st.ty - st.cy) < 0.3 && Math.abs(st.pt - st.p) < 0.002;
        // Plates edit: once the zone has faded out completely its position no
        // longer shows, so stop instead of gliding after a distant cursor
        if (st.pt === 0 && st.p < 0.002) settled = true;
        if (settled) { st.cx = st.tx; st.cy = st.ty; st.p = st.pt; st.moving = false; }
        render();
        return st.moving;
      },
      refresh: queueRaster,
      // Plates edit: cheap color-only update (no re-raster). Re-reads the
      // heading's current CSS color and redraws one frame, so the goo can
      // follow a theme cross-fade frame by frame.
      recolor: function () {
        if (!ready || destroyed || gl.isContextLost()) return;
        color = parseColor(o.color || getComputedStyle(host).color);
        render();
      },
      destroy: function () {
        destroyed = true;
        io && io.disconnect();
        ro && ro.disconnect();
        mo && mo.disconnect();
        var i = instances.indexOf(inst);
        if (i > -1) instances.splice(i, 1);
        host.classList.remove("goo-on", "goo-text");
        canvas.remove();
        var lose = gl.getExtension("WEBGL_lose_context");
        if (lose) lose.loseContext();
        delete host.__goo;
      }
    };
    host.__goo = inst;
    instances.push(inst);

    /* ---- keep in sync with layout, content and fonts ---- */
    var ro = global.ResizeObserver ? new ResizeObserver(queueRaster) : null;
    if (ro) ro.observe(host);
    var mo = global.MutationObserver ? new MutationObserver(function (list) {
      for (var i = 0; i < list.length; i++) if (list[i].target !== canvas) { queueRaster(); return; }
    }) : null;
    if (mo) mo.observe(host, { childList: true, characterData: true, subtree: true });

    // Plates edit: touch intro trigger
    var io = (o.intro && global.IntersectionObserver) ? new IntersectionObserver(function (en) {
      if (!en[0].isIntersecting) return;
      io.disconnect(); st.introGo = true; startIntro();
    }, { rootMargin: "0px 0px -12% 0px" }) : null;
    if (io) io.observe(host);
    else if (o.intro) st.introGo = true;

    canvas.addEventListener("webglcontextlost", function (e) {
      e.preventDefault(); host.classList.remove("goo-on"); ready = false;
    });
    canvas.addEventListener("webglcontextrestored", function () {
      inst.destroy(); init(host, userOpts);
    });

    // wait for web fonts so the goo is drawn from the brand face, not a fallback
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(queueRaster);
    else queueRaster();

    installGlobalListeners();
    return inst;
  }

  /* ------------------------------------------------------------------ */
  /* one shared pointer listener + animation loop for all instances      */
  /* ------------------------------------------------------------------ */
  var lastX = 0, lastY = 0, hasPointer = false, listening = false;
  var running = false, lastT = 0;

  function trackAll() {
    for (var i = 0; i < instances.length; i++) instances[i].track(lastX, lastY, hasPointer);
  }
  function wake() {
    if (running) return;
    running = true; lastT = performance.now();
    requestAnimationFrame(loop);
  }
  function loop(now) {
    var dt = Math.min((now - lastT) / 1000, 0.05); lastT = now;
    var any = false;
    for (var i = 0; i < instances.length; i++) if (instances[i].step(dt)) any = true;
    if (any) requestAnimationFrame(loop); else running = false;
  }
  function installGlobalListeners() {
    if (listening) return;
    listening = true;
    global.addEventListener("pointermove", function (e) {
      if (e.pointerType === "touch") return;
      lastX = e.clientX; lastY = e.clientY; hasPointer = true; trackAll();
    }, { passive: true });
    document.addEventListener("pointerleave", function () { hasPointer = false; trackAll(); });
    document.documentElement.addEventListener("mouseleave", function () { hasPointer = false; trackAll(); });
    global.addEventListener("scroll", function () { if (hasPointer) trackAll(); }, { passive: true, capture: true });
    global.addEventListener("resize", function () {
      for (var i = 0; i < instances.length; i++) instances[i].refresh();
    });
    if (document.fonts && document.fonts.addEventListener) {
      document.fonts.addEventListener("loadingdone", function () {
        for (var i = 0; i < instances.length; i++) instances[i].refresh();
      });
    }
  }

  function initAll(root) {
    var els = (root || document).querySelectorAll("[data-goo]");
    var out = [];
    for (var i = 0; i < els.length; i++) { var x = init(els[i]); if (x) out.push(x); }
    return out;
  }

  global.GooText = { init: init, initAll: initAll, defaults: DEFAULTS };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { initAll(); });
  else initAll();
})(window);
