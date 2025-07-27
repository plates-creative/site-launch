let lensShader;
let pg;

function preload() {
  lensShader = loadShader('shader.vert', 'shader.frag');
}

function setup() {
  createCanvas(windowWidth, windowHeight, WEBGL);
  pg = createGraphics(windowWidth, windowHeight); // Use default 2D renderer for text
  pg.pixelDensity(1);
  pg.textSize(32);
  pg.textAlign(CENTER, CENTER);
  pg.textFont('monospace');
  noStroke();
  textureMode(NORMAL);
}

function draw() {
  background(255, 62,  181);

  // Move text with mouse
  let tx = map(mouseX, 0, width, -width / 4, width / 4);
  let ty = map(mouseY, 0, height, -height / 4, height / 4);

  // Draw text into buffer
  pg.clear();
  pg.background(255, 62,  181);
  pg.fill(0);
  pg.text('PART STUDIO,', pg.width / 2 + tx, pg.height / 2 + ty - 20);
  pg.text('PART THOUGHT', pg.width / 2 + tx, pg.height / 2 + ty + 20);
  pg.text('EXPERIMENT', pg.width / 2 + tx, pg.height / 2 + ty + 60);

  // Apply shader
  shader(lensShader);
  lensShader.setUniform('uTex', pg);
  lensShader.setUniform('uResolution', [width, height]);
  lensShader.setUniform('uLensCenter', [0.5, 0.5]);
  lensShader.setUniform('uLensRadius', min(width, height) * 0.45);
  lensShader.setUniform('uAspect', width / height);

  // Fullscreen quad in clip space
 beginShape(TRIANGLE_STRIP);
vertex(-1, -1, 0, 1); // bottom-left
vertex(1, -1, 1, 1);  // bottom-right
vertex(-1, 1, 0, 0);  // top-left
vertex(1, 1, 1, 0);   // top-right
endShape();

}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight, WEBGL);
  pg = createGraphics(windowWidth, windowHeight); // Stay in 2D mode
  pg.pixelDensity(1);
  pg.textSize(32);
  pg.textAlign(CENTER, CENTER);
  pg.textFont('monospace');
}
