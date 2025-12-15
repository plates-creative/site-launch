// --- Plates Shard Snowflake (Microsite edition) ---
// UI is HTML; p5 handles rendering + hi-res export.
// Rotation is CSS-only (canvas animation).

// ---------- CONFIG ----------
const EXPORT_SIZE = 1080;
const CSS_ROTATION_SECONDS = 28; // must match CSS spin duration
const MOBILE_BREAKPOINT = 1024;  // phone + tablet treated as static

// Mobile/tablet: static p5 (noLoop), desktop: animated p5 (breathing + crossfade)
let IS_MOBILE = false;

// Optional: keep these if you want, but you can set them equal to desktop now
// (since mobile is static). I’m leaving them “desktop-equal” by default.
const MOBILE_PLACEMENT_LIMIT = 9999; // effectively no cap

async function inlineSvgs() {
  const imgs = document.querySelectorAll('img[data-inline-svg]');
  await Promise.all([...imgs].map(async (img) => {
    const res = await fetch(img.src);
    const text = await res.text();
    const svg = new DOMParser()
      .parseFromString(text, "image/svg+xml")
      .querySelector("svg");

    if (!svg) return;

    // Carry over classes from <img> to <svg>
    svg.classList.add("svg-icon");
    img.classList.forEach(cls => svg.classList.add(cls));

    img.replaceWith(svg);
  }));
}


// ---------- ASSET PATHS ----------
let shardPaths = [
  "snowflake/assets/s_01.png","snowflake/assets/s_02.png","snowflake/assets/s_03.png","snowflake/assets/s_04.png",
  "snowflake/assets/s_05.png","snowflake/assets/s_06.png","snowflake/assets/s_07.png","snowflake/assets/s_08.png",
  "snowflake/assets/s_09.png","snowflake/assets/s_10.png","snowflake/assets/s_11.png","snowflake/assets/s_12.png",
  "snowflake/assets/a_01.png","snowflake/assets/a_02.png","snowflake/assets/a_03.png","snowflake/assets/a_04.png",
  "snowflake/assets/a_05.png","snowflake/assets/a_06.png","snowflake/assets/a_07.png","snowflake/assets/a_08.png",
  "snowflake/assets/a_09.png","snowflake/assets/a_10.png","snowflake/assets/a_11.png","snowflake/assets/a_12.png",
  "snowflake/assets/a_13.png","snowflake/assets/a_14.png",
];

let cnv;
let rawImages = [];
let shards = [];
let placements = [];

// ---------- TRANSITION STATE (desktop only) ----------
let oldPlacements = null;
let newPlacements = null;
let transitionProgress = 1;
let transitioning = false;

let NUM_SYMMETRY = 6;
let currentSymmetry = NUM_SYMMETRY;
let oldSymmetry = NUM_SYMMETRY;
let newSymmetry = NUM_SYMMETRY;

// ---------- COLORS (tap-to-cycle) ----------
const MODES = [
  { key: "black", bg: "#181818", shape: "#FF3EB5" },
  { key: "pink",  bg: "#FF3EB5", shape: "#181818" },
  { key: "white", bg: "#DBDBDB", shape: "#181818" },
];
let modeIndex = 0;
let bgColor = MODES[modeIndex].bg;
let shapeColor = MODES[modeIndex].shape;

// ---------- CANVAS ----------
let CANVAS_SIZE = 800;

// ---------- PRELOAD ----------
function preload(){
  for (let p of shardPaths) rawImages.push(loadImage(p));
}

// ---------- SETUP ----------
function setup(){
  inlineSvgs();
  IS_MOBILE = windowWidth < MOBILE_BREAKPOINT;

  const sizeFactor = IS_MOBILE ? 0.86 : 0.90;
  CANVAS_SIZE = min(windowWidth, windowHeight) * sizeFactor;

  pixelDensity(IS_MOBILE ? 2 : 2); // you chose simple route: 2 everywhere

  cnv = createCanvas(CANVAS_SIZE, CANVAS_SIZE);
  cnv.parent("sketch-holder");
  cnv.elt.style.transformOrigin = "50% 50%";

  // Mobile/tablet: static p5
  if (IS_MOBILE) noLoop();
  else loop();

  smooth();
  drawingContext.imageSmoothingEnabled = true;

  // Wire HTML UI
  wireUI();

  processShards();

  const initial = generateSnowflakeReturnPlacements();
  placements = initial.placements;
  currentSymmetry = initial.symmetry;

  applyModeToPage();

  if (IS_MOBILE) redraw();
}

// ---------- UI ----------
function wireUI(){
  const btnRandom = document.getElementById("btn-randomize");
  const btnColor  = document.getElementById("btn-color");
  const btnSave   = document.getElementById("btn-save");

  if (btnRandom) btnRandom.addEventListener("click", startTransition);
  if (btnColor)  btnColor.addEventListener("click", cycleMode);
  if (btnSave)   btnSave.addEventListener("click", saveHiResSnowflake);
}

function cycleMode(){
  modeIndex = (modeIndex + 1) % MODES.length;
  bgColor = MODES[modeIndex].bg;
  shapeColor = MODES[modeIndex].shape;
  applyModeToPage();

  if (IS_MOBILE) redraw();
}

function applyModeToPage(){
  const mode = MODES[modeIndex];

  // CSS owns the background now; this keeps it in sync
  document.body.style.backgroundColor = mode.bg;
  document.body.dataset.theme = mode.key;

  // Optional: remove if you’re not using these anywhere
  document.body.classList.remove("mode-pink","mode-black","mode-white");
  document.body.classList.add(`mode-${mode.key}`);
}


// ---------- RESIZE ----------
function windowResized(){
  IS_MOBILE = windowWidth < MOBILE_BREAKPOINT;

  const sizeFactor = IS_MOBILE ? 0.86 : 0.90;
  CANVAS_SIZE = min(windowWidth, windowHeight) * sizeFactor;

  resizeCanvas(CANVAS_SIZE, CANVAS_SIZE);

  // Reprocess because baseScale uses CANVAS_SIZE
  processShards();

  // Regenerate to fit
  const next = generateSnowflakeReturnPlacements();
  placements = next.placements;
  currentSymmetry = next.symmetry;
  transitioning = false;

  if (IS_MOBILE){
    noLoop();
    redraw();
  } else {
    loop();
  }
}

// ---------- PROCESS SHARDS ----------
function processShards(){
  shards = [];
  const targetRadius = CANVAS_SIZE * 0.03;

  for (let img of rawImages){
    if (!img) continue;
    const bounds = getOpaqueBounds(img);
    if (!bounds) continue;

    const cropped = img.get(bounds.minX, bounds.minY, bounds.w, bounds.h);
    toWhiteMask(cropped);

    const naturalRadius = 0.25 * Math.sqrt(bounds.w*bounds.w + bounds.h*bounds.h);
    const baseScale = targetRadius / naturalRadius;

    shards.push({
      img: cropped,
      w: bounds.w,
      h: bounds.h,
      naturalRadius,
      baseScale
    });
  }
}

function toWhiteMask(img){
  img.loadPixels();
  const w = img.width, h = img.height;
  for (let y=0; y<h; y++){
    for (let x=0; x<w; x++){
      const idx = 4*(y*w + x);
      const a = img.pixels[idx+3];
      if (a === 0) continue;
      img.pixels[idx+0] = 255;
      img.pixels[idx+1] = 255;
      img.pixels[idx+2] = 255;
    }
  }
  img.updatePixels();
}

function getOpaqueBounds(img, alphaThreshold=1){
  img.loadPixels();
  let minX=img.width, minY=img.height, maxX=-1, maxY=-1;

  for (let y=0; y<img.height; y++){
    for (let x=0; x<img.width; x++){
      const idx = 4*(y*img.width + x);
      const a = img.pixels[idx+3];
      if (a > alphaThreshold){
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < 0) return null;
  return { minX, minY, w: (maxX-minX+1), h: (maxY-minY+1) };
}

// ---------- DRAW ----------
function draw(){
  clear();
  translate(width/2, height/2);
  noStroke();

  const t = millis() * 0.001;

  // Mobile/tablet: static draw only
  if (IS_MOBILE){
    drawSnowflake(placements, t, 255, currentSymmetry, false);
    return;
  }

  // Desktop: breathing + crossfade
  if (!transitioning){
    drawSnowflake(placements, t, 255, currentSymmetry, true);
    return;
  }

  const fade = transitionProgress;
  drawSnowflake(oldPlacements, t, 255*(1-fade), oldSymmetry, true);
  drawSnowflake(newPlacements, t, 255*fade, newSymmetry, true);

  transitionProgress += 0.03;
  if (transitionProgress >= 1){
    transitioning = false;
    placements = newPlacements;
    currentSymmetry = newSymmetry;
  }
}

function drawSnowflake(list, t, alphaValue, symmetry, includeBreath){
  if (!list) return;

  const alphaHex = hex(floor(alphaValue), 2);
  tint(shapeColor + alphaHex);

  for (let placement of list){
    const shard = shards[placement.shardIndex];

    const breath = (includeBreath)
      ? (1 + placement.breathAmt * sin(t*0.7 + placement.phase))
      : 1;

    const px = placement.cx * breath;
    const py = placement.cy * breath;

    for (let k=0; k<symmetry; k++){
      push();
      rotate((TWO_PI/symmetry) * k);
      translate(px, py);
      rotate(placement.rotation);
      imageMode(CENTER);
      image(shard.img, 0, 0, shard.w*placement.scale, shard.h*placement.scale);
      pop();
    }
  }

  noTint();
}

// ---------- RANDOMIZE ----------
function startTransition(){
  if (IS_MOBILE){
    const next = generateSnowflakeReturnPlacements();
    placements = next.placements;
    currentSymmetry = next.symmetry;
    transitioning = false;
    redraw();
    return;
  }

  oldPlacements = placements;
  oldSymmetry = currentSymmetry;

  const next = generateSnowflakeReturnPlacements();
  newPlacements = next.placements;
  newSymmetry = next.symmetry;

  transitionProgress = 0;
  transitioning = true;
}

// ---------- GENERATOR ----------
function generateSnowflakeReturnPlacements(){
  let temp = [];

  // full complexity everywhere now
  const SYM_MIN = 4, SYM_MAX = 9;
  NUM_SYMMETRY = floor(random(SYM_MIN, SYM_MAX + 1));

  const indices = shuffledIndices(shards.length);
  let idx = 0;
  function nextShardIndex(){
    if (idx >= indices.length) idx = 0;
    return indices[idx++];
  }

  const centerRadius = CANVAS_SIZE * 0.08;
  const maxRadius = CANVAS_SIZE * 0.46;

  const numLevels = 17;
  const maxBranchAngle = 0.3;

  const wedgeAngle = TWO_PI / NUM_SYMMETRY;
  const halfWedge = wedgeAngle / 2;
  const allowedBranchAngle = min(maxBranchAngle, halfWedge * 0.6);

  for (let i=0; i<numLevels; i++){
    const tt = (i+0.5)/numLevels;
    const r = lerp(centerRadius, maxRadius*0.9, tt) + random(-10,10);

    // spine
    {
      const shardIndex = nextShardIndex();
      placeShard(temp, shardIndex, r, random(-0.04,0.04), random(0.8,1.2));
    }

    // side branches
    const branchCount = random([0,1,2]);
    if (branchCount > 0){
      const sideAngle = random(allowedBranchAngle*0.6, allowedBranchAngle);

      // right
      {
        const shardIndex = nextShardIndex();
        placeShard(temp, shardIndex, r*random(0.9,1.05), sideAngle, random(0.6,1.0));
      }

      // left
      if (branchCount === 2){
        const shardIndex = nextShardIndex();
        placeShard(temp, shardIndex, r*random(0.9,1.05), -sideAngle, random(0.6,1.0));
      }
    }

    // tip
    if (i === numLevels-1){
      const shardIndex = nextShardIndex();
      placeShard(temp, shardIndex, maxRadius*random(0.95,1.05), random(-0.05,0.05), random(0.5,0.9));
    }
  }

  // frost accents
  const extraCount = 4;
  for (let i=0; i<extraCount; i++){
    const shardIndex = nextShardIndex();
    placeShard(temp, shardIndex,
      random(centerRadius*0.8, maxRadius),
      random(-halfWedge*0.85, halfWedge*0.85),
      random(0.4,0.7)
    );
  }

  return { placements: temp, symmetry: NUM_SYMMETRY };
}

function placeShard(list, shardIndex, r, angle, scaleJitterFactor){
  if (IS_MOBILE && list.length >= MOBILE_PLACEMENT_LIMIT) return;

  const shard = shards[shardIndex];
  const scaleVal = shard.baseScale * (scaleJitterFactor || 1);

  const cx = r * Math.cos(angle);
  const cy = r * Math.sin(angle);

  const rad = shard.naturalRadius * scaleVal;
  const rotation = random(-0.4,0.4);

  if (!collidesWithExisting(list, cx, cy, rad)){
    list.push({
      cx, cy, rotation,
      scale: scaleVal,
      shardIndex,
      r: rad,
      phase: random(TWO_PI),
      breathAmt: random(0.03,0.12)
    });
  }
}

function collidesWithExisting(existing, cx, cy, r){
  const padding = 3;
  const step = existing.length > 80 ? 2 : 1;

  for (let i=0; i<existing.length; i+=step){
    const p = existing[i];
    const dx = cx - p.cx;
    const dy = cy - p.cy;
    const minDist = r + p.r + padding;
    if ((dx*dx + dy*dy) < (minDist*minDist)) return true;
  }
  return false;
}

function shuffledIndices(n){
  const arr = [...Array(n).keys()];
  for (let i=n-1; i>0; i--){
    const j = floor(random(i+1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ---------- HI-RES EXPORT THAT MATCHES WHAT YOU SEE ----------
function saveHiResSnowflake(){
  const pg = createGraphics(EXPORT_SIZE, EXPORT_SIZE);
  pg.pixelDensity(1);
  pg.background(bgColor);
  pg.noStroke();

  const scaleFactor = EXPORT_SIZE / CANVAS_SIZE;

  const tNow = millis() * 0.001;
  const rot = getCssRotationAngleRad();

  pg.push();
  pg.translate(EXPORT_SIZE/2, EXPORT_SIZE/2);
  pg.rotate(rot);
  pg.scale(scaleFactor);

  if (!IS_MOBILE && transitioning && oldPlacements && newPlacements){
    const fade = constrain(transitionProgress, 0, 1);
    drawSnowflakeTo(pg, oldPlacements, tNow, 255*(1-fade), oldSymmetry, true);
    drawSnowflakeTo(pg, newPlacements, tNow, 255*fade, newSymmetry, true);
  } else {
    drawSnowflakeTo(pg, placements, tNow, 255, currentSymmetry, !IS_MOBILE);
  }

  pg.pop();
  save(pg, "plates-snowflake-1080", "png");
  pg.remove();
}

function getCssRotationAngleRad(){
  const phase = (millis()/1000) / CSS_ROTATION_SECONDS;
  const frac = phase - Math.floor(phase);
  return frac * TWO_PI;
}

function drawSnowflakeTo(g, list, t, alphaValue, symmetry, includeBreath){
  if (!list) return;
  const c = color(shapeColor);
  g.tint(red(c), green(c), blue(c), alphaValue);

  for (let placement of list){
    const shard = shards[placement.shardIndex];

    const breath = includeBreath
      ? (1 + placement.breathAmt * sin(t*0.7 + placement.phase))
      : 1;

    const px = placement.cx * breath;
    const py = placement.cy * breath;

    for (let k=0; k<symmetry; k++){
      g.push();
      g.rotate((TWO_PI/symmetry) * k);
      g.translate(px, py);
      g.rotate(placement.rotation);
      g.imageMode(CENTER);
      g.image(shard.img, 0, 0, shard.w*placement.scale, shard.h*placement.scale);
      g.pop();
    }
  }

  g.noTint();
}
