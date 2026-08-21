/* Fixed properties of the press. Nothing here is user state — see state.js. */

/* The sheet is fixed. Dot size is measured in sheet pixels, so the sheet size and
   the dot size together decide the ruling: the same 6px cell is 50 lpi on a 1400
   sheet and 71 lpi on a 2000 one. The plates were calibrated here, so this is a
   property of the press rather than a setting. Export scale multiplies both
   together, which changes the output size without touching the ruling. */
export const SHEET_PX = 1400;

export const DEFAULTS = {
  // plate
  bypass: true,
  // house sepia, fitted to the brand reference
  sepiaLo: "#281e1e", sepiaHi: "#fad4b6", sepiaGamma: 3.02, sepiaLift: 4.24,
  // screen. Not exposed as controls: the plates own these. They carry the Fine
  // values so the state underneath is always a real plate, never a phantom look.
  dotSize: 6, dotScale: 1.2, rotation: -180, centerX: 0, centerY: 0,
  contrast: 0.5, clipToAlpha: true, invert: false,
  // ink
  ink: "#fad4b6", paper: "#281e1e",
  // tone (the image is always desaturated first, that is not a setting)
  highlights: 0, shadows: 0,
  // vellum: a translucent sheet over the finished image. Blur, sheet colour and
  // opacity fitted to the brand reference pair; the tooth is the Figma noise pass.
  vellum: false, blur: 0.40, sheetAmount: 0.34,
  // placement
  fit: 0, zoom: 1, mediaRotation: 0, offsetX: 0, offsetY: 0,
  // output
  aspect: "source", exportScale: 2
};

/* the screen settings a plate carries, shared by every plate that has one */
const PLATE = {
  dotScale: 1.2, rotation: -180, centerX: 0, centerY: 0,
  ink: "#fad4b6", paper: "#281e1e", highlights: 0, shadows: 0,
  contrast: 0.5, clipToAlpha: true, invert: false
};

export const PRESETS = [
  { name: "None",   note: "sepia only . no screen", v: { bypass: true } },
  { name: "Fine",   note: "dot 6 . detailed",       v: { ...PLATE, dotSize: 6 } },
  { name: "Coarse", note: "dot 12 . abstract",      v: { ...PLATE, dotSize: 12 } }
];

export const FIT_MODES = [["0", "Crop to fill"], ["1", "Fit inside"]];

export const RATIOS = [
  ["source", "Source"],
  ["16:9", "16:9 landscape"],
  ["9:16", "9:16 vertical"],
  ["4:5", "4:5 portrait"],
  ["1:1", "1:1 square"],
  ["circle", "1:1 circle crop"]
];

/* the palette is fixed, so these are the only inks there are */
export const INKS = [["#fad4b6", "Shell"], ["#dedad5", "Stone"], ["#9cb29e", "Seafoam"]];
export const PAPERS = [["#281e1e", "Root"], ["none", "Transparent"]];

/* colour bar under the sheet, the way a proof carries one */
export const COLORBAR = ["#fad4b6", "#d4ab92", "#a9836f", "#7b5f51", "#4f3c36", "#281e1e"];
