import { media, mark } from "./state.js";
import { MAXTEX, uploadSource, resizeScratch } from "./source-texture.js";
import { fitCanvas } from "./renderer.js";
import { writeMeta } from "./panels.js";
import { toast } from "./toast.js";

const IMG_EXT = /\.(jpe?g|png|webp|bmp|avif)$/i;

/* the browser sometimes hands over an empty type, so the name is checked too */
function isImage(f) {
  const t = f.type || "";
  return (t.startsWith("image/") && t !== "image/gif") || IMG_EXT.test(f.name);
}

export function setMedia(el, w, h, name) {
  if (!w || !h) {
    toast("That file reported no dimensions");
    return;
  }
  media.natW = w;
  media.natH = h;

  /* clamp to what the GPU will hold, keeping the ratio */
  if (Math.max(w, h) > MAXTEX) {
    const s = MAXTEX / Math.max(w, h);
    w = Math.round(w * s);
    h = Math.round(h * s);
  }

  media.el = el;
  media.w = w;
  media.h = h;
  media.name = name;
  media.viaCanvas = (w !== media.natW);
  media.ready = true;
  if (media.viaCanvas) resizeScratch(w, h);

  fitCanvas();
  uploadSource();
  writeMeta();
  mark();
}

function loadImage(file) {
  const done = (img, url) => {
    if (url) URL.revokeObjectURL(url);
    setMedia(img, img.naturalWidth, img.naturalHeight, file.name);
  };

  /* blob URLs can be refused when the page is opened straight off disk, so fall
     back to a data URL */
  const viaData = () => {
    const r = new FileReader();
    r.onload = () => {
      const img = new Image();
      img.onload = () => done(img);
      img.onerror = () => toast("Could not decode " + file.name);
      img.src = r.result;
    };
    r.onerror = () => toast("Could not read " + file.name);
    r.readAsDataURL(file);
  };

  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => done(img, url);
  img.onerror = () => { URL.revokeObjectURL(url); viaData(); };
  img.src = url;
}

export function loadFile(file) {
  if (!file) return;
  if (!isImage(file)) {
    toast("Stills only: JPG, PNG, WEBP or AVIF");
    return;
  }
  loadImage(file);
}
