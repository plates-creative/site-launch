import { canvas, gl, buildProgram, use, u, makeTarget, sizeTarget, drawTo, bind } from "./gl.js";
import { FRAG, FRAG_PRE, FRAG_DOWN, FRAG_BLUR, FRAG_COMP } from "./shaders.js";
import { P, media, mark, consumeDirty, session } from "./state.js";
import { SHEET_PX } from "./config.js";
import { sourceTex } from "./source-texture.js";

export { canvas };

const progPlate = buildProgram(FRAG);
const progPre   = buildProgram(FRAG_PRE);
const progDown  = buildProgram(FRAG_DOWN);
const progBlur  = buildProgram(FRAG_BLUR);
const progComp  = buildProgram(FRAG_COMP);
use(progPlate);

const tSharp = makeTarget();
const tBlurTmp = makeTarget();
const tMip = [0, 1, 2, 3, 4, 5].map(makeTarget);   /* full res down to 1/32 */

function hex2rgb(h) {
  const n = parseInt(h.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/* ── sheet size ───────────────────────────────────────────────── */
export function fitCanvas() {
  if (!media.ready) return;
  let aw = media.w, ah = media.h;
  if (P.aspect === "circle") {
    aw = ah = 1;                                  /* the disc sits in a square sheet */
  } else if (P.aspect !== "source") {
    const [x, y] = String(P.aspect).split(":");
    aw = parseFloat(x);
    ah = parseFloat(y);
  }
  const target = Math.min(SHEET_PX, Math.max(media.w, media.h) || 1);
  const s = target / Math.max(aw, ah);
  canvas.width  = Math.max(2, Math.round(aw * s));
  canvas.height = Math.max(2, Math.round(ah * s));
  mark();
}

/* ── uniforms for the plate pass ──────────────────────────────── */
function setPlateUniforms(w, h, k) {
  /* paper "none" is the transparent case: the ground drops out and the dots
     carry their own alpha, so the ink colour stays pure at the dot edges */
  const clear = P.paper === "none";
  const ink = hex2rgb(P.ink);
  const paper = clear ? ink : hex2rgb(P.paper);

  gl.uniform2f(u("uRes"), w, h);
  gl.uniform2f(u("uTexSize"), Math.max(media.w, 1), Math.max(media.h, 1));
  /* The lattice origin is pinned, not tied to the sheet. Anchoring it to the
     sheet meant every change of Sheet ratio moved the grid and the dots landed
     somewhere new under the same image. Centre is scaled by k so the phase is
     also identical at every export scale. */
  gl.uniform2f(u("uCenter"), P.centerX * k, P.centerY * k);
  gl.uniform2f(u("uOffset"), P.offsetX * k, -P.offsetY * k);
  gl.uniform1f(u("uCell"), Math.max(P.dotSize * k, 0.35));
  gl.uniform1f(u("uDotScale"), P.dotScale);
  gl.uniform1f(u("uAngle"), -P.rotation);
  gl.uniform1f(u("uClip"), P.clipToAlpha ? 1 : 0);
  gl.uniform1f(u("uInvert"), P.invert ? 1 : 0);
  gl.uniform1f(u("uInkGamma"), 1 + 4 * P.contrast);
  gl.uniform3f(u("uInk"), ink[0], ink[1], ink[2]);
  gl.uniform3f(u("uPaper"), paper[0], paper[1], paper[2]);
  gl.uniform1f(u("uPaperAlpha"), clear ? 0 : 1);
  gl.uniform1f(u("uHigh"), P.highlights);
  gl.uniform1f(u("uShad"), P.shadows);
  gl.uniform1f(u("uFit"), P.fit);
  gl.uniform1f(u("uZoom"), Math.max(P.zoom, 0.02));
  gl.uniform1f(u("uMediaRot"), P.mediaRotation);
  gl.uniform1f(u("uHasTex"), media.ready ? 1 : 0);
  gl.uniform1f(u("uBypass"), P.bypass ? 1 : 0);

  const lo = hex2rgb(P.sepiaLo), hi = hex2rgb(P.sepiaHi);
  gl.uniform3f(u("uSepiaLo"), lo[0], lo[1], lo[2]);
  gl.uniform3f(u("uSepiaHi"), hi[0], hi[1], hi[2]);
  gl.uniform1f(u("uSepiaGamma"), P.sepiaGamma);
  gl.uniform1f(u("uSepiaLift"), P.sepiaLift);

  /* Minify to the sheet only. Pre-blurring by the dot size was averaging whole
     cells together, which flattened interior detail and lifted pure blacks. */
  const long = Math.max(media.w, media.h) || 1;
  const srcPerScreen = long / Math.max(canvas.width, canvas.height);
  gl.uniform1f(u("uMipBias"), Math.max(0, Math.log2(Math.max(1, srcPerScreen))));
}

/* ── vellum: premultiply, shrink, blur ────────────────────────── */
function renderBlur(w, h) {
  /* Sigma is a fraction of the long edge, so the softness is the same at any
     sheet size or export scale. The image is only shrunk as far as the blur
     will erase anyway: a wide blur can be done cheaply at low resolution, but
     a small one has to stay at full resolution or the shrink is the only
     thing you see. At blur 0 nothing is shrunk and nothing is blurred, so the
     plate reaches the composite pixel for pixel. */
  const sigma = P.blur / 100 * Math.max(w, h);
  let lvl = 0;
  while (sigma / (1 << lvl) > 8 && lvl < tMip.length - 1 &&
         (w >> (lvl + 1)) > 8 && (h >> (lvl + 1)) > 8) lvl++;

  sizeTarget(tMip[0], w, h);
  for (let i = 1; i <= lvl; i++) sizeTarget(tMip[i], Math.max(1, w >> i), Math.max(1, h >> i));
  sizeTarget(tBlurTmp, tMip[lvl].w, tMip[lvl].h);

  use(progPre);                                   /* premultiply for a clean edge */
  bind(tSharp.tex, 0);
  gl.uniform1i(u("uSrc"), 0);
  gl.uniform2f(u("uSrcTexel"), 1 / w, 1 / h);
  drawTo(tMip[0]);

  for (let i = 1; i <= lvl; i++) {                /* halve, one step at a time */
    use(progDown);
    bind(tMip[i - 1].tex, 0);
    gl.uniform1i(u("uSrc"), 0);
    gl.uniform2f(u("uSrcTexel"), 1 / tMip[i - 1].w, 1 / tMip[i - 1].h);
    drawTo(tMip[i]);
  }

  if (sigma > 0.05) {
    const lw = tMip[lvl].w, lh = tMip[lvl].h;
    use(progBlur);                                /* separable gaussian */
    gl.uniform1f(u("uSigma"), sigma / (1 << lvl));
    gl.uniform2f(u("uTexel"), 1 / lw, 1 / lh);
    bind(tMip[lvl].tex, 0);
    gl.uniform1i(u("uSrc"), 0);
    gl.uniform2f(u("uDir"), 1, 0);
    drawTo(tBlurTmp);
    bind(tBlurTmp.tex, 0);
    gl.uniform2f(u("uDir"), 0, 1);
    drawTo(tMip[lvl]);
  }

  return tMip[lvl];
}

/* ── the full run ─────────────────────────────────────────────── */
export function render(w, h, k) {
  sizeTarget(tSharp, w, h);

  /* 1. the plate itself, into a target so the vellum passes can read it back */
  use(progPlate);
  bind(sourceTex, 0);
  gl.uniform1i(u("uTex"), 0);
  setPlateUniforms(w, h, k);
  gl.clearColor(0, 0, 0, 0);
  gl.bindFramebuffer(gl.FRAMEBUFFER, tSharp.fbo);
  gl.viewport(0, 0, w, h);
  gl.clear(gl.COLOR_BUFFER_BIT);
  drawTo(tSharp);

  const blurSrc = P.vellum ? renderBlur(w, h) : tSharp;

  /* 2. composite: sheet, tooth and the die cut, straight to the canvas */
  use(progComp);
  bind(tSharp.tex, 0);
  gl.uniform1i(u("uSharp"), 0);
  bind(blurSrc.tex, 1);
  gl.uniform1i(u("uBlur"), 1);
  gl.uniform2f(u("uRes"), w, h);
  gl.uniform1f(u("uVellum"), P.vellum ? 1 : 0);
  gl.uniform1f(u("uSheetAmt"), P.sheetAmount);
  gl.uniform1f(u("uNoiseScale"), Math.max(0.5, 1.5 * k));
  gl.uniform1f(u("uCircle"), P.aspect === "circle" ? 1 : 0);
  const paperRGB = hex2rgb(P.paper === "none" ? P.ink : P.paper);
  gl.uniform3f(u("uPaper"), paperRGB[0], paperRGB[1], paperRGB[2]);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.clear(gl.COLOR_BUFFER_BIT);
  drawTo(null);
}

function draw() {
  render(canvas.width, canvas.height, 1);
}

export function startLoop() {
  const frame = () => {
    /* while exporting, the canvas is temporarily at export size — leave it alone
       and keep the dirty flag set for when it comes back */
    if (!session.exporting && consumeDirty()) draw();
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
