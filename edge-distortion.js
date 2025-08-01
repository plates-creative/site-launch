// edge-distortion.js
// New approach: capture a full raster of the body once, then scroll-align slices into top and bottom distortion shaders

let topCanvas, bottomCanvas, glTop, glBottom;
let shaderProgram;
let fullImage = new Image();
let rasterCanvas, rasterCtx;

const DISTORT_HEIGHT = 80; // px

function setupCanvas(id) {
  const canvas = document.getElementById(id);
  canvas.width = window.innerWidth;
  canvas.height = DISTORT_HEIGHT;
  return canvas.getContext("webgl");
}

async function init() {
  glTop = setupCanvas("top-distortion");
  glBottom = setupCanvas("bottom-distortion");

  const vertSource = await fetch("/glass-distortion.vert").then(res => res.text());
  const fragSource = await fetch("/glass-distortion.frag").then(res => res.text());
  shaderProgram = createShaderProgram(glTop, vertSource, fragSource);

  // Create a full raster of the page body
  html2canvas(document.body, {
    useCORS: true,
    backgroundColor: null,
    windowWidth: document.body.scrollWidth,
    windowHeight: document.body.scrollHeight,
    scale: 1
  }).then(canvas => {
    rasterCanvas = canvas;
    rasterCtx = canvas.getContext("2d");
    fullImage.src = canvas.toDataURL();
    fullImage.onload = () => {
      window.addEventListener("scroll", throttle(updateDistortionRegions, 100));
      updateDistortionRegions();
    };
  });
}

function updateDistortionRegions() {
  if (!rasterCtx || !fullImage.complete) return;

  const scrollY = Math.max(0, Math.min(window.scrollY, rasterCanvas.height - window.innerHeight));

  const topY = Math.max(0, scrollY);
  const bottomY = Math.max(0, Math.min(scrollY + window.innerHeight - DISTORT_HEIGHT, rasterCanvas.height - DISTORT_HEIGHT));

  const topSlice = rasterCtx.getImageData(0, topY, window.innerWidth, DISTORT_HEIGHT);
  const bottomSlice = rasterCtx.getImageData(0, bottomY, window.innerWidth, DISTORT_HEIGHT);

  const topCanvasEl = canvasFromImageData(topSlice);
  const bottomCanvasEl = canvasFromImageData(bottomSlice);

  const topImg = new Image();
  topImg.onload = () => render(glTop, topImg);
  topImg.src = topCanvasEl.toDataURL();

  const bottomImg = new Image();
  bottomImg.onload = () => render(glBottom, bottomImg);
  bottomImg.src = bottomCanvasEl.toDataURL();
}

function canvasFromImageData(imgData) {
  const c = document.createElement("canvas");
  c.width = imgData.width;
  c.height = imgData.height;
  c.getContext("2d").putImageData(imgData, 0, 0);
  return c;
}

function render(gl, image) {
  if (!gl || !image.complete || !shaderProgram) return;

  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    image
  );
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);

  gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
  gl.clear(gl.COLOR_BUFFER_BIT);

  gl.useProgram(shaderProgram);

  const positionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([
      -1, -1,
      1, -1,
      -1, 1,
      1, 1,
    ]),
    gl.STATIC_DRAW
  );

  const positionLoc = gl.getAttribLocation(shaderProgram, "aPosition");
  gl.enableVertexAttribArray(positionLoc);
  gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);

  const textureLoc = gl.getUniformLocation(shaderProgram, "uTexture");
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.uniform1i(textureLoc, 0);

  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}

function createShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error("Shader compile error:", gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function createShaderProgram(gl, vertSrc, fragSrc) {
  const vertShader = createShader(gl, gl.VERTEX_SHADER, vertSrc);
  const fragShader = createShader(gl, gl.FRAGMENT_SHADER, fragSrc);
  const program = gl.createProgram();
  gl.attachShader(program, vertShader);
  gl.attachShader(program, fragShader);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error("Program link error:", gl.getProgramInfoLog(program));
    return null;
  }
  return program;
}

function throttle(fn, wait) {
  let timeout;
  return function (...args) {
    if (!timeout) {
      timeout = setTimeout(() => {
        timeout = null;
        fn(...args);
      }, wait);
    }
  };
}

document.fonts.ready.then(() => setTimeout(init, 100));
