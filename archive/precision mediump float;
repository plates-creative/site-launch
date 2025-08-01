precision mediump float;

uniform sampler2D uTex;
uniform vec2 uResolution;

varying vec2 vTexCoord;

void main() {
  vec2 uv = vTexCoord;

  // Simulate distortion near top and bottom
  float edgeFade = smoothstep(0.0, 0.1, uv.y) * smoothstep(1.0, 0.9, uv.y);
  vec2 distortedUV = uv + vec2(0.0, sin(uv.x * 10.0) * 0.01 * edgeFade);

  // Chromatic aberration simulation
  float ca = 0.001 * edgeFade;
  vec4 r = texture2D(uTex, distortedUV + vec2(ca, 0.0));
  vec4 g = texture2D(uTex, distortedUV);
  vec4 b = texture2D(uTex, distortedUV - vec2(ca, 0.0));

  gl_FragColor = vec4(r.r, g.g, b.b, 1.0);
}
