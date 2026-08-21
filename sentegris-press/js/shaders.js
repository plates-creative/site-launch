/* GLSL ES 3.0. Every program draws one full-screen triangle from gl_VertexID,
   so there are no buffers or attributes anywhere in this tool. */

export const VERT = `#version 300 es
void main(){
  vec2 p = vec2((gl_VertexID<<1)&2, gl_VertexID&2);
  gl_Position = vec4(p*2.0-1.0, 0.0, 1.0);
}`;

/* ── the plate: sepia, screen, ink and paper ───────────────────── */
export const FRAG = `#version 300 es
precision highp float;
precision highp int;
uniform sampler2D uTex;
uniform vec2  uRes, uTexSize, uCenter, uOffset;
uniform float uCell, uDotScale, uAngle, uClip, uInvert, uInkGamma;
uniform vec3  uInk, uPaper;
uniform float uPaperAlpha, uHigh, uShad;
uniform vec3  uSepiaLo, uSepiaHi;
uniform float uSepiaGamma, uSepiaLift;
uniform float uFit, uZoom, uMediaRot, uHasTex, uMipBias, uBypass;
out vec4 fragColor;

float luma(vec3 c){ return dot(c, vec3(0.2126,0.7152,0.0722)); }
mat2 rot2(float a){ float s=sin(a), c=cos(a); return mat2(c,-s,s,c); }

float fitScale(){
  float r = radians(uMediaRot);
  float ca = abs(cos(r)), sa = abs(sin(r));
  vec2 box = vec2(ca*uRes.x + sa*uRes.y, sa*uRes.x + ca*uRes.y);
  vec2 f = box / max(uTexSize, vec2(1.0));
  float k = (uFit < 0.5) ? max(f.x, f.y) : min(f.x, f.y);
  return max(k * uZoom, 0.0001);
}

vec4 sampleSrc(vec2 frag){
  if(uHasTex < 0.5) return vec4(0.0);
  vec2 c = frag - uRes*0.5 - uOffset;
  c = rot2(-radians(uMediaRot)) * c;
  vec2 uv = c / (fitScale() * uTexSize) + 0.5;
  if(uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return vec4(0.0);
  return textureLod(uTex, uv, uMipBias);
}

/* Every image is converted to neutral grey before the screen, always. The plate
   has to read the same whatever colour walked in, so this is not optional and
   there is no saturation control to get out of step with it. Highlights and
   shadows then open the ends of that grey curve. */
float tone(vec3 c){
  float g = luma(clamp(c, 0.0, 1.0));
  g += uHigh * 0.55 * smoothstep(0.42, 1.0, g);
  g += uShad * 0.55 * (1.0 - smoothstep(0.0, 0.58, g));
  return clamp(g, 0.0, 1.0);
}

float inkOf(float v){
  /* coverage follows whichever end of the scale the ink sits on: dark ink on light
     paper grows dots in the shadows, light ink on dark paper grows them in the
     highlights. Either way the print reads positive and Negative genuinely inverts. */
  float pol = step(luma(uPaper), luma(uInk));
  float ink = mix(1.0 - v, v, pol);
  ink = mix(ink, 1.0 - ink, uInvert);
  /* the screen curve. 1 is linear, dot area tracking tone. Higher steepens it so
     midtones shrink faster than highlights and the plate gains separation. */
  ink = pow(clamp(ink, 0.0, 1.0), uInkGamma);
  /* a screen cannot hold a dot below a few percent coverage, it drops out. Without
     this an almost black ground still raises a dot in every cell, since an area
     correct screen turns 0.4% tone into a 6% radius. Resolution independent, so
     preview and export agree. */
  ink *= smoothstep(0.0, 0.03, ink);
  return ink;
}

/* The house sepia. Every upload is desaturated and then mapped through this
   duotone before anything else, so all content shares one tonal signature
   whatever walked in. Fitted to the brand before and after pair: a gamma into a
   rational lift, which reproduces the reference to a mean 2.2 levels per channel
   over every pixel. The lift is what a plain gamma could not do, holding the
   shadows down while opening the midtones. It is monotonic and maps 0 and 1 to
   the two endpoints exactly, so no tone clips at either end. */
vec3 sepia(float v){
  float t = pow(clamp(v, 0.0, 1.0), uSepiaGamma);
  t = t * (1.0 + uSepiaLift) / (1.0 + uSepiaLift * t);
  return clamp(uSepiaLo + (uSepiaHi - uSepiaLo) * t, 0.0, 1.0);
}

/* Every dot is a true circle at any size. Each fragment is tested against the
   nine nearest cell centres and keeps the strongest coverage, so a dot that
   grows past its own cell overlaps its neighbours instead of being sliced flat
   by the cell boundary. Nine is enough for the whole dot scale range: a dot has
   to reach 1.5 cells before a further ring of neighbours could touch it. */
float screen(vec2 frag){
  float cell = max(uCell, 0.35);
  float a = radians(uAngle);
  mat2 Ri = rot2(a);
  vec2 p = (rot2(-a) * (frag - uCenter)) / cell;   /* fragment in cell units */
  vec2 base = floor(p);
  float aa = 0.72 / cell;                          /* a fixed 0.72 device pixels */
  float m = 0.0;
  for(int j = -1; j <= 1; j++){
    for(int i = -1; i <= 1; i++){
      vec2 c = base + vec2(float(i), float(j)) + 0.5;
      vec4 t = sampleSrc(Ri * (c * cell) + uCenter);   /* one reading per cell, at its centre */
      float live = (uClip > 0.5) ? step(0.5, t.a) : 1.0;
      float r = sqrt(inkOf(tone(t.rgb))) * 0.5 * uDotScale;
      float dm = 1.0 - smoothstep(r - aa, r + aa, length(p - c));
      /* a dot finer than one pixel prints as partial coverage, not a full pixel */
      dm *= clamp(3.14159 * r * r * cell * cell, 0.0, 1.0);
      m = max(m, dm * live);
    }
  }
  return m;
}

void main(){
  vec2 frag = gl_FragCoord.xy;

  /* no plate: the art converted to the house sepia and placed on the sheet.
     This is the first step, not a preview of the untouched file. */
  if(uBypass > 0.5){
    vec4 t = sampleSrc(frag);
    fragColor = vec4(mix(uPaper, sepia(tone(t.rgb)), t.a), max(uPaperAlpha, t.a));
    return;
  }

  float m = screen(frag);

  vec3 col = mix(uPaper, uInk, m);
  /* on a transparent sheet the alpha carries the dot, so the colour stays pure ink */
  col = mix(col, uInk, 1.0 - uPaperAlpha);

  fragColor = vec4(col, mix(uPaperAlpha, 1.0, m));
}`;

/* ── Vellum passes ────────────────────────────────────────────────
   A wide blur cannot be done in one pass, so the base render goes to a target,
   is shrunk, blurred separably, and composited back under a translucent sheet.
   Blurring in premultiplied alpha keeps the paper from bleeding into the
   transparent corners of a circle crop. */

export const FRAG_PRE = `#version 300 es
precision highp float;
uniform sampler2D uSrc;
uniform vec2 uSrcTexel;
out vec4 fragColor;
void main(){
  vec4 s = texture(uSrc, gl_FragCoord.xy * uSrcTexel);
  fragColor = vec4(s.rgb * s.a, s.a);   /* premultiply before blurring */
}`;

export const FRAG_DOWN = `#version 300 es
precision highp float;
uniform sampler2D uSrc;
uniform vec2 uSrcTexel;
out vec4 fragColor;
void main(){
  /* exact 2x2 box halving. Repeated as needed rather than one big jump, so
     nothing is thrown away that the blur will not immediately discard. */
  vec2 uv = gl_FragCoord.xy * 2.0 * uSrcTexel;
  fragColor = 0.25 * (
      texture(uSrc, uv + vec2(-0.5, -0.5) * uSrcTexel)
    + texture(uSrc, uv + vec2( 0.5, -0.5) * uSrcTexel)
    + texture(uSrc, uv + vec2(-0.5,  0.5) * uSrcTexel)
    + texture(uSrc, uv + vec2( 0.5,  0.5) * uSrcTexel));
}`;

export const FRAG_BLUR = `#version 300 es
precision highp float;
uniform sampler2D uSrc;
uniform vec2 uTexel, uDir;
uniform float uSigma;
out vec4 fragColor;
void main(){
  vec2 uv = gl_FragCoord.xy * uTexel;
  float s = max(uSigma, 0.0001);
  vec4 sum = texture(uSrc, uv);
  float wsum = 1.0;
  for(int i = 1; i <= 48; i++){
    float x = float(i);
    if(x > s * 3.0) break;
    float w = exp(-0.5 * x * x / (s * s));
    vec2 o = uDir * uTexel * x;
    sum += (texture(uSrc, uv + o) + texture(uSrc, uv - o)) * w;
    wsum += 2.0 * w;
  }
  fragColor = sum / wsum;
}`;

export const FRAG_COMP = `#version 300 es
precision highp float;
uniform sampler2D uSharp, uBlur;
uniform vec2  uRes;
uniform float uVellum, uSheetAmt, uNoiseScale, uCircle;
uniform vec3  uPaper;
out vec4 fragColor;

const float SAVE_OPACITY = 0.80;   /* what a vellum sheet saves at */

float hash21(vec2 p){
  p = fract(p * vec2(127.31, 311.7));
  p += dot(p, p.yx + 19.19);
  return fract((p.x + p.y) * p.x);
}

void main(){
  vec2 frag = gl_FragCoord.xy;
  vec4 c = texture(uSharp, frag / uRes);

  if(uVellum > 0.5){
    vec4 b = texture(uBlur, frag / uRes);
    /* the blur target holds premultiplied alpha, so undo it before compositing */
    vec3 blurred = b.a > 0.001 ? b.rgb / b.a : b.rgb;
    c = vec4(blurred, b.a);
    /* Two separate decisions, which were one control before and fought each
       other. Sheet opacity is how much the stock tints what is printed on it,
       and it alone sets the look. Export opacity is how translucent the saved
       file is. Tying them meant the sheet lightened the pixels and then let the
       background through as well, washing the result out twice over. */
    /* The stock is fixed, not a choice, and both values are brand: the sheet is
       Shell and the tooth is Root, the same value the Figma noise pass uses.
       Shell is 10 luma points lighter than the colour fitted off the reference
       export, so the default sheet opacity is set 6 points lower to land on the
       same tone. */
    const vec3 SHEET = vec3(0.980, 0.831, 0.714);   /* Shell #FAD4B6 */
    const vec3 TOOTH = vec3(0.157, 0.118, 0.118);   /* Root  #281E1E */
    c.rgb = mix(c.rgb, SHEET, uSheetAmt);
    /* the stock is solid where it lays down, so it closes any gaps in the art */
    c.a = mix(c.a, 1.0, uSheetAmt);
    /* the tooth of the vellum, a fine mono grain sitting on top */
    float g = hash21(floor(frag / max(uNoiseScale, 0.5)));
    c.rgb = mix(c.rgb, TOOTH, 0.02 * g);   /* the tooth is the stock, not a setting */
  }

  /* Alpha is decided here and nowhere else, so a file is opaque unless one of
     exactly two things asked for it not to be:
       the vellum sheet, which saves at 80% so it drops into a layout as a real
         translucent sheet
       Paper set to Transparent, where the dots carry their own edges
     Nothing else can, including a source image with its own alpha. */
  float a = (uVellum > 0.5) ? c.a * SAVE_OPACITY : c.a;

  /* Circular crop. The disc is a die cut: outside it the sheet always falls
     away, whatever Paper is set to, so a circle export drops into a layout as a
     real disc rather than a disc on a rectangle. Paper still decides the ground
     *inside* the disc — on Root the disc prints solid brown under the ink, on
     Transparent the dots carry their own edges. The rgb is blended toward the
     paper colour across the boundary rather than toward black, so the
     antialiased edge carries no dark fringe. */
  if(uCircle > 0.5){
    float rad = min(uRes.x, uRes.y) * 0.5;
    float inside = 1.0 - smoothstep(rad - 0.75, rad + 0.75, length(frag - uRes * 0.5));
    c.rgb = mix(uPaper, c.rgb, inside);
    a    *= inside;
  }
  fragColor = vec4(c.rgb, clamp(a, 0.0, 1.0));
}`;
