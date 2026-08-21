import { VERT } from "./shaders.js";
import { fatal } from "./fatal.js";

export const canvas = document.getElementById("out");

export const gl = canvas.getContext("webgl2", {
  alpha: true, premultipliedAlpha: false, preserveDrawingBuffer: true, antialias: false
});

if (!gl) {
  throw fatal("This tool needs WebGL2.", "Try a current Chrome, Safari, Edge or Firefox.");
}

/* one full-screen triangle, generated in the vertex shader: no buffers needed,
   but a bound VAO is still required */
gl.bindVertexArray(gl.createVertexArray());

function compile(type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    throw fatal("The screen would not compile.", gl.getShaderInfoLog(s));
  }
  return s;
}

export function buildProgram(fragSrc) {
  const p = gl.createProgram();
  gl.attachShader(p, compile(gl.VERTEX_SHADER, VERT));
  gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fragSrc));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    throw fatal("The screen would not link.", gl.getProgramInfoLog(p));
  }
  p._u = {};   /* uniform locations, cached per program */
  return p;
}

let current = null;
export function use(p) {
  current = p;
  gl.useProgram(p);
}
export const u = name =>
  (name in current._u ? current._u[name] : (current._u[name] = gl.getUniformLocation(current, name)));

/* ── render targets ───────────────────────────────────────────────
   Creating or resizing a target has to bind its texture, which would clobber
   whatever the shaders are about to sample. All housekeeping is therefore done
   on a scratch unit that nothing samples from. */
const SCRATCH_UNIT = 7;

export function makeTarget() {
  const t = { tex: gl.createTexture(), fbo: gl.createFramebuffer(), w: 0, h: 0 };
  gl.activeTexture(gl.TEXTURE0 + SCRATCH_UNIT);
  gl.bindTexture(gl.TEXTURE_2D, t.tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.bindFramebuffer(gl.FRAMEBUFFER, t.fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t.tex, 0);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return t;
}

export function sizeTarget(t, w, h) {
  w = Math.max(1, w | 0);
  h = Math.max(1, h | 0);
  if (t.w === w && t.h === h) return t;
  gl.activeTexture(gl.TEXTURE0 + SCRATCH_UNIT);
  gl.bindTexture(gl.TEXTURE_2D, t.tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  t.w = w;
  t.h = h;
  return t;
}

/* pass null to draw to the canvas */
export function drawTo(t) {
  gl.bindFramebuffer(gl.FRAMEBUFFER, t ? t.fbo : null);
  gl.viewport(0, 0, t ? t.w : canvas.width, t ? t.h : canvas.height);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
}

export function bind(tex, unit) {
  gl.activeTexture(gl.TEXTURE0 + unit);
  gl.bindTexture(gl.TEXTURE_2D, tex);
}
