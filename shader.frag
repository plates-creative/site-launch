precision mediump float;

uniform sampler2D uTex;
uniform vec2 uResolution;
uniform vec2 uLensCenter;
uniform float uLensRadius;
uniform float uAspect;

varying vec2 vTexCoord;

void main() {
  vec2 uv = vTexCoord;
  vec2 center = uLensCenter;
  float radius = uLensRadius / min(uResolution.x, uResolution.y);

  // Adjust for aspect ratio
  vec2 adjustedFromCenter = uv - center;
  adjustedFromCenter.x *= uAspect;
  float dist = length(adjustedFromCenter);

  vec2 lensUV = uv;

  if (dist < radius) {
    // Invert the falloff so warping increases outward from center
    float t = dist / radius;
    float distortion = mix(1.0, 0.3, pow(t, 2.0));  // distort outer more than inner
    lensUV = center + (uv - center) * distortion;
  } else {
    discard;
  }

  // Chromatic aberration
  float caOffset = 0.0005;

  vec4 r = texture2D(uTex, lensUV + vec2(caOffset, 0.0));
  vec4 g = texture2D(uTex, lensUV);
  vec4 b = texture2D(uTex, lensUV - vec2(caOffset, 0.0));

  gl_FragColor = vec4(r.r, g.g, b.b, 1.0);
}
