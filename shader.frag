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
  vec2 offsetFromCenter = uv - center;
  offsetFromCenter.x *= uAspect;
  float dist = length(offsetFromCenter);

  vec4 finalColor;

  if (dist < radius) {
    // Inside lens: distort and sample texture
    float t = dist / radius;
    float distortion = mix(1.0, 0.3, pow(t, 2.0));
    vec2 distortedUV = center + (uv - center) * distortion;

    // Chromatic aberration
    float caOffset = 0.0002;
    vec4 r = texture2D(uTex, distortedUV + vec2(caOffset, 0.0));
    vec4 g = texture2D(uTex, distortedUV);
    vec4 b = texture2D(uTex, distortedUV - vec2(caOffset, 0.0));

    finalColor = vec4(r.r, g.g, b.b, 1.0);
  } else {
    // Outside lens: hot pink
    finalColor = vec4(1.0, 62.0/255.0, 181.0/255.0, 1.0);
  }

  gl_FragColor = finalColor;
}
