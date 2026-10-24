let lensShader;
let pg;
let ownersFont;
let scaleFactor = 1;
let activeX = window.innerWidth / 2;
let activeY = window.innerHeight / 2;
let isIdle = true;
let lastInteractionTime = 0;
let hasInteracted = false;

// Lorenz system parameters
let x = 0.1, y = 0, z = 0;
const sigma = 7;      //reactivity to X/Y differences
const rho = 25;       //energy
const beta = 8 / 5;   //vertical compression, more = less
const dt = 0.005;     //simulatino speed

// Anchor position for mapping attractor
let idleAnchorX = window.innerWidth / 2;
let idleAnchorY = window.innerHeight / 2;

function preload() {
  ownersFont = loadFont('assets/owners-medium.otf');
  lensShader = loadShader('shader.vert', 'shader.frag');
}

function setup() {
  let canvas = createCanvas(windowWidth, windowHeight, WEBGL);
  canvas.position(0, 0);
  canvas.style('z-index', '-1');

  pg = createGraphics(windowWidth, windowHeight);
  pg.pixelDensity(window.devicePixelRatio || 1);

  if (windowHeight > windowWidth) {
    scaleFactor = 0.9;
  }

  pg.textSize(32 * scaleFactor);
  pg.textAlign(CENTER, CENTER);
  pg.textFont(ownersFont);
  pg.smooth();

  noStroke();
  textureMode(NORMAL);

  lastInteractionTime = millis();
  setAttributes('antialias', true);
  frameRate(60);
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight, WEBGL);
  pg = createGraphics(windowWidth, windowHeight);
  pg.pixelDensity(window.devicePixelRatio || 1);
  pg.textSize(32);
  pg.textAlign(CENTER, CENTER);
  pg.textFont(ownersFont);
  pg.smooth();
}

function draw() {
  background(255, 62, 181);
  let now = millis();

  // Re-enter idle mode after short pause
  if (!isIdle && now - lastInteractionTime > 300) {
    isIdle = true;
    idleAnchorX = activeX;
    idleAnchorY = activeY;
  }

  if (isIdle) {
    // Lorenz attractor integration step
    let dx = sigma * (y - x) * dt;
    let dy = (x * (rho - z) - y) * dt;
    let dz = (x * y - beta * z) * dt;

    x += dx;
    y += dy;
    z += dz;

    // Map Lorenz values to screen position around the last interaction anchor
    activeX = idleAnchorX + map(x, -20, 20, -100, 100);
    activeY = idleAnchorY + map(z, 0, 50, -75, 75);
  }

  let tx = map(activeX, 0, width, -width / 4, width / 4);
  let ty = map(activeY, 0, height, -height / 4, height / 4);

  pg.clear();
  pg.background(255, 62, 181);
  pg.fill(0);
  pg.text('PART      STUDIO,', pg.width / 2 + tx, pg.height / 2 + ty - 15 * scaleFactor);
  pg.text('PART THOUGHT', pg.width / 2 + tx, pg.height / 2 + ty + 15 * scaleFactor);
  pg.text('EXPERIMENT', pg.width / 2 + tx, pg.height / 2 + ty + 45 * scaleFactor);

  shader(lensShader);
  lensShader.setUniform('uTex', pg);
  lensShader.setUniform('uResolution', [width, height]);
  lensShader.setUniform('uLensCenter', [0.5, 0.5]);
  lensShader.setUniform('uLensRadius', min(width, height) * 0.45);
  lensShader.setUniform('uAspect', width / height);

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
  lastInteractionTime = millis();
  isIdle = false;
  hasInteracted = true;
}

function touchMoved() {
  if (touches.length > 0) {
    activeX = touches[0].x;
    activeY = touches[0].y;
    lastInteractionTime = millis();
    isIdle = false;
    hasInteracted = true;
  }
  return false;
}

function touchStarted() {
  if (touches.length > 0) {
    activeX = touches[0].x;
    activeY = touches[0].y;
    lastInteractionTime = millis();
    isIdle = false;
    hasInteracted = true;
  }
  return false;
}