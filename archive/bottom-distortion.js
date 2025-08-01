let lensShader;
let pg;
let captured;
let captureReady = false;
let scrollTimeout = null;

window.addEventListener('scroll', () => {
  if (scrollTimeout) return;

  scrollTimeout = setTimeout(() => {
    captureBackground();  // this updates `captured`
    scrollTimeout = null;
  }, 100); // capture at ~10fps on scroll
});


function preload() {
  lensShader = loadShader('info-shader.vert', 'info-shader.frag');
}

function captureBackground() {
  html2canvas(document.documentElement, {
    width: window.innerWidth,
    height: window.innerHeight,
    useCORS: true,
    scrollY: -window.scrollY
  }).then(canvas => {
    captured = createGraphics(canvas.width, canvas.height);
    captured.drawingContext.drawImage(canvas, 0, 0);
    captureReady = true;
  });
}

function setup() {
  const canvas = createCanvas(windowWidth, 80, WEBGL);
  canvas.parent('bottom-glass');
  noStroke();

  captureBackground(); // Initial capture
}

function draw() {
  if (!captureReady || !captured) return;

  shader(lensShader);
  lensShader.setUniform('uTex', captured);
  lensShader.setUniform('uResolution', [width, height]);

  plane(width, height);

}

function windowResized() {
  resizeCanvas(windowWidth, 80);
}
