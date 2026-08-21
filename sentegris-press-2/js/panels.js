import { P, media, mark, resetParams } from "./state.js";
import { DEFAULTS, PRESETS, RATIOS, INKS, PAPERS, FIT_MODES, SHEET_PX } from "./config.js";
import { UI, el, range, select, toggleGroup, swatchRow, setChangeHook, f2, pct } from "./controls.js";
import { canvas, fitCanvas } from "./renderer.js";
import { toast } from "./toast.js";

const $ = id => document.getElementById(id);

/* ── sections ─────────────────────────────────────────────────── */
$("srcControls").append(
  select("fit", "Fit", FIT_MODES),
  range("mediaRotation", "Rotate art", -180, 180, 90, v => v + "\u00B0"),
  range("zoom", "Zoom", 0.1, 4, 0.01, v => f2(v) + "\u00D7"),
  range("offsetX", "Shift X", -1000, 1000, 1, v => Math.round(v) + "px"),
  range("offsetY", "Shift Y", -1000, 1000, 1, v => Math.round(v) + "px")
);

$("inkControls").append(
  swatchRow("ink", "Ink", INKS),
  swatchRow("paper", "Paper", PAPERS)
);

$("vellumControls").append(
  toggleGroup([["vellum", "Vellum sheet", on => {
    /* The vellum is a finish laid over the sepia, not over a screen: a plate
       and a sheet are two different outputs, never the same one. Switching one
       on releases the other rather than letting them stack. */
    if (on && !P.bypass) {
      P.bypass = true;
      setActivePlate(noneBtn);
      syncUI();
      toast("Plate cleared: the sheet lays over the sepia");
    }
    showVellum();
  }]]),
  range("blur", "Blur", 0, 6, 0.01, v => v.toFixed(2) + "%"),
  range("sheetAmount", "Sheet opacity", 0, 1, 0.01, pct)
);

$("outControls").append(
  select("aspect", "Aspect ratio", RATIOS, () => { fitCanvas(); readouts(); showAlpha(); }),
  range("exportScale", "Export scale", 1, 4, 1, v => v + "\u00D7 | " + (SHEET_PX * v) + "px")
);

/* ── plates ───────────────────────────────────────────────────── */
const presetWrap = $("presets");
export let noneBtn = null;
let activePlate = null;

export function setActivePlate(btn) {
  if (activePlate) activePlate.classList.remove("on");
  activePlate = btn || null;
  if (activePlate) activePlate.classList.add("on");
  /* selection is otherwise carried by a colour and a 2px rule alone */
  for (const b of presetWrap.children) b.setAttribute("aria-pressed", String(b === activePlate));
}

for (const p of PRESETS) {
  const isNone = p.name === "None";
  const b = el("button", null, `<strong>${p.name}</strong><em>${p.note}</em>`);
  b.type = "button";
  b.setAttribute("aria-pressed", "false");
  if (isNone) noneBtn = b;
  b.addEventListener("click", () => {
    const keep = {
      aspect: P.aspect, exportScale: P.exportScale,
      blur: P.blur, sheetAmount: P.sheetAmount,
      /* Ink and Paper belong to the Ink section, not to the plate: a plate is a
         screen, not a colourway. Resetting Paper here silently undid a
         Transparent selection, which is what a circle crop needs to cut. */
      ink: P.ink, paper: P.paper,
      /* a screen and a sheet are never both on */
      vellum: isNone ? P.vellum : false
    };
    Object.assign(P, DEFAULTS, { bypass: false }, p.v, keep);
    fitCanvas();
    syncUI();
    mark();
    setActivePlate(b);
    toast(isNone ? "Showing the original" : p.name + " plate loaded");
  });
  presetWrap.append(b);
}

export function resetAll() {
  resetParams();
  fitCanvas();
  syncUI();
  mark();
  setActivePlate(P.bypass ? noneBtn : null);
  toast("Reset to the original");
}

/* ── stage chrome ─────────────────────────────────────────────── */

/* the vellum settings sit inert until the sheet is switched on, and say so */
function showVellum() {
  $("vellumControls").classList.toggle("off", !P.vellum);
  showAlpha();
}

/* the stage shows a checkerboard wherever the sheet carries alpha: the
   transparent paper toggle, the vellum sheet, or a circle crop, whose corners
   are now always cut away */
function showAlpha() {
  const frame = $("frame");
  frame.classList.toggle("alpha", P.paper === "none" || P.vellum || P.aspect === "circle");
  frame.classList.toggle("round", P.aspect === "circle");
}

export function readouts() {
  const lpi = 300 / Math.max(P.dotSize, 0.01);
  $("rRuling").textContent =
    P.bypass ? "off" : (lpi >= 100 ? Math.round(lpi) : lpi.toFixed(1)) + " lpi";
  $("rAngle").textContent = P.bypass ? "\u2013" : Math.round(P.rotation) + "\u00B0";
  $("rSize").textContent = canvas.width + " \u00D7 " + canvas.height;
  $("rMode").textContent = P.bypass ? "Sepia" : (P.invert ? "Halftone negative" : "Halftone");
}

export function writeMeta() {
  const box = $("meta");
  box.replaceChildren();
  if (!media.ready) return;

  const name = document.createElement("b");
  name.textContent = media.name;                  /* textContent: filenames are untrusted */
  const dims = media.natW + " \u00D7 " + media.natH +
    (media.w !== media.natW ? ` . sampled at ${media.w} \u00D7 ${media.h}` : "");

  box.append(name, document.createElement("br"), document.createTextNode(dims));
}

export function syncUI() {
  for (const k of Object.keys(UI)) UI[k].sync?.();
  readouts();
  showAlpha();
  showVellum();
}

setChangeHook(readouts);
