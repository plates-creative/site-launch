attribute vec2 aPosition;
varying vec2 vUv;

void main() {
  vUv = aPosition * 0.5 + 0.5; // Map from [-1,1] to [0,1]
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
