let lensShader;
let pg;
let ownersFont;

function preload() {
  ownersFont = loadFont('owners-medium.otf');
  lensShader = loadShader('shader.vert', 'shader.frag');
}

function setup() {
  createCanvas(windowWidth, windowHeight, WEBGL);

  pg = createGraphics(windowWidth, windowHeight); // Use default 2D renderer
 pg.pixelDensity(window.devicePixelRatio || 1);
  pg.textSize(32);
  pg.textAlign(CENTER, CENTER);
  pg.textFont(ownersFont);
  pg.smooth();

  noStroke();
  textureMode(NORMAL);
}
function windowResized() {
  resizeCanvas(windowWidth, windowHeight, WEBGL);

  pg = createGraphics(windowWidth, windowHeight);
pg.pixelDensity(window.devicePixelRatio || 1);
  pg.textSize(32);
  pg.textAlign(CENTER, CENTER);
  pg.textFont(ownersFont); // Fix: use loaded font here too
  pg. smooth();
}

function draw() {
  background(255, 62, 181);

  // Move text with mouse or touch on mobile
let tx, ty;

if (touches.length > 0) {
  tx = map(touchX, 0, width, -width / 4, width / 4);
  ty = map(touchY, 0, height, -height / 4, height / 4);
} else {
  tx = map(mouseX, 0, width, -width / 4, width / 4);
  ty = map(mouseY, 0, height, -height / 4, height / 4);
}

  // Draw text to offscreen buffer
  pg.clear();
  pg.background(255, 62, 181);
  pg.fill(0);
pg.text('PART      STUDIO,', pg.width / 2 + tx, pg.height / 2 + ty - 15);
  pg.text('PART THOUGHT', pg.width / 2 + tx, pg.height / 2 + ty + 15);
  pg.text('EXPERIMENT', pg.width / 2 + tx, pg.height / 2 + ty + 45);

  // Apply shader
  shader(lensShader);
  lensShader.setUniform('uTex', pg);
  lensShader.setUniform('uResolution', [width, height]);
  lensShader.setUniform('uLensCenter', [0.5, 0.5]);
  lensShader.setUniform('uLensRadius', min(width, height) * 0.45);
  lensShader.setUniform('uAspect', width / height);

  // Fullscreen quad
  beginShape(TRIANGLE_STRIP);
  vertex(-1, -1, 0, 1);
  vertex(1, -1, 1, 1);
  vertex(-1, 1, 0, 0);
  vertex(1, 1, 1, 0);
  endShape();
}
