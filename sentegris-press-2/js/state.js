import { DEFAULTS } from "./config.js";

/* Every setting the console can change. Mutated in place so every module holds
   the same object — never reassign P. */
export const P = { ...DEFAULTS };

export function resetParams() {
  Object.assign(P, DEFAULTS);
}

/* the art currently on the press */
export const media = {
  el: null, w: 0, h: 0, natW: 0, natH: 0,
  viaCanvas: false, name: "", ready: false
};

/* the render loop draws only when something has changed */
let dirty = true;
export function mark() { dirty = true; }
export function consumeDirty() {
  const was = dirty;
  dirty = false;
  return was;
}

/* held while a PNG is being rendered at export scale, so the loop leaves the
   canvas alone */
export const session = { exporting: false };
