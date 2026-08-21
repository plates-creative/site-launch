import { P, media, mark, session } from "./state.js";
import { canvas, render } from "./renderer.js";
import { readouts } from "./panels.js";
import { toast } from "./toast.js";

function stem() {
  return (media.name || "untitled")
    .replace(/\.[^.]+$/, "")
    .replace(/[^\w-]+/g, "-")
    .slice(0, 40) || "untitled";
}

function download(blob, name) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  toast("Saved " + name);
}

/* Rendered fresh at export scale rather than upscaled, so the dot holds its
   look: the ruling is fixed to the sheet, and k scales the lattice with it. */
export function savePng() {
  if (!media.ready) {
    toast("Load some art first");
    return;
  }

  const scale = P.exportScale;
  const w = canvas.width, h = canvas.height;

  session.exporting = true;
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);

  const restore = () => {
    canvas.width = w;
    canvas.height = h;
    session.exporting = false;
    mark();
    readouts();
  };

  try {
    render(canvas.width, canvas.height, scale);
    canvas.toBlob(blob => {
      if (blob) {
        const lpi = Math.round(300 / Math.max(P.dotSize, 0.01));
        download(blob, stem() + (P.bypass ? "_sepia.png" : `_halftone_${lpi}lpi.png`));
      } else {
        toast("The sheet would not save");
      }
      restore();
    }, "image/png");
  } catch (err) {
    /* never leave the render loop parked because an export threw */
    restore();
    toast("The sheet would not save");
    throw err;
  }
}
