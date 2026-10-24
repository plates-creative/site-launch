let lensShader;
let pg;
let ownersFont;
let scaleFactor = 1;
let activeX = window.innerWidth / 2;
let activeY = window.innerHeight / 2;
let isIdle = true;
let idleStartX = window.innerWidth / 2;
let idleStartY = window.innerHeight / 2;
let idleStartTime = 0;
let lastInteractionTime = 0;
let hasInteracted = false;

// Ambient motion parameters locked per idle cycle
let idleSpeedX = 0;
let idleSpeedY = 0;
let idleAmpX = 0;
let idleAmpY = 0;

function preload() {
  ownersFont = loadFont('assets/owners-medium.otf');
  lensShader = loadShader('shader.vert', 'shader.frag');
}

function setup() {
  let canvas = createCanvas(windowWidth, windowHeight, WEBGL);
  canvas.position(0, 0);
  canvas.style('z-index', '1');

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
  idleStartTime = millis();

  // Start ambient motion immediately
  let t = idleStartTime * 0.001;
  idleSpeedX = 0.7 + sin(t * 0.15) * 0.15;
  idleSpeedY = 0.65 + cos(t * 0.11) * 0.15;
  idleAmpX = 60 + sin(t * 0.07) * 20;
  idleAmpY = 65 + cos(t * 0.09) * 25;

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

  if (isIdle) {
    let t = (now - idleStartTime) * 0.001;
    activeX = idleStartX + sin(t * idleSpeedX) * idleAmpX;
    activeY = idleStartY + cos(t * idleSpeedY) * idleAmpY;
  }

  if (!isIdle && now - lastInteractionTime > 300) {
  isIdle = true;
  idleStartTime = now;

  // Reset idle origin to current position
  idleStartX = activeX;
  idleStartY = activeY;

  // Lock new motion parameters
  let t = now * 0.001;
  idleSpeedX = 0.7 + sin(t * 0.15) * 0.15;
  idleSpeedY = 0.65 + cos(t * 0.11) * 0.15;
  idleAmpX = 60 + sin(t * 0.07) * 20;
  idleAmpY = 65 + cos(t * 0.09) * 25;
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