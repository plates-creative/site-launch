let lensShader;
let pg;
let ownersFont;
let scaleFactor = 1;
let activeX = window.innerWidth / 2;
let activeY = window.innerHeight / 2;

function preload() {
  ownersFont = loadFont('assets/owners-medium.otf');
  lensShader = loadShader('shader.vert', 'shader.frag');
}

function setup() {
  createCanvas(windowWidth, windowHeight, WEBGL);
  let canvas = createCanvas(windowWidth, windowHeight);
  canvas.position(0, 0);
  canvas.style('z-index', '-1');

  pg = createGraphics(windowWidth, windowHeight); // Use default 2D renderer
  pg.pixelDensity(window.devicePixelRatio || 1);

    if (windowHeight > windowWidth) {
    // Portrait mode
    scaleFactor = 0.9; // or lower like 0.6 for smaller phones
  }

  pg.textSize(32 * scaleFactor);
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
  let tx = map(activeX, 0, width, -width / 4, width / 4);
  let ty = map(activeY, 0, height, -height / 4, height / 4);


  // Draw text to offscreen buffer
  pg.clear();
  pg.background(255, 62, 181);
  pg.fill(0);
  pg.text('PART      STUDIO,', pg.width / 2 + tx, pg.height / 2 + ty - 15 * scaleFactor);
  pg.text('PART THOUGHT', pg.width / 2 + tx, pg.height / 2 + ty + 15 * scaleFactor);
  pg.text('EXPERIMENT', pg.width / 2 + tx, pg.height / 2 + ty + 45 * scaleFactor);

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

function mouseMoved() {
  activeX = mouseX;
  activeY = mouseY;
}

function touchMoved() {
  if (touches.length > 0) {
    activeX = touches[0].x;
    activeY = touches[0].y;
  }
  return false; // Prevents default scrolling
}
function touchStarted() {
  if (touches.length > 0) {
    activeX = touches[0].x;
    activeY = touches[0].y;
  }
}
