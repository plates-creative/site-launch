precision mediump float;

uniform sampler2D uTexture;
varying vec2 vUv;

void main() {
  vec2 uv = vUv;

  // Vertical-only distortion strength, centered at middle height
  float strength = abs(uv.y - 0.5);         // how far from center vertically
  float verticalDistort = strength * 0.25;  // adjust distortion amount here

  // Chromatic aberration (horizontal shift only)
  float chroma = 0.004;
  float r = texture2D(uTexture, uv + vec2(chroma, verticalDistort)).r;
  float g = texture2D(uTexture, uv + vec2(0.0, verticalDistort)).g;
  float b = texture2D(uTexture, uv + vec2(-chroma, verticalDistort)).b;

  gl_FragColor = vec4(r, g, b, 1.0);
}
