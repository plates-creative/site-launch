import { gl } from "./gl.js";
import { media } from "./state.js";
import { toast } from "./toast.js";

export const sourceTex = gl.createTexture();

gl.activeTexture(gl.TEXTURE0);
gl.bindTexture(gl.TEXTURE_2D, sourceTex);
gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);

/* the largest edge the GPU will hold, capped so a huge upload cannot stall it */
export const MAXTEX = Math.min(gl.getParameter(gl.MAX_TEXTURE_SIZE) || 4096, 4096);

/* only used when a file is larger than the GPU will hold and has to be shrunk */
const scratch = document.createElement("canvas");
const scratchCtx = scratch.getContext("2d");

export function resizeScratch(w, h) {
  scratch.width = w;
  scratch.height = h;
}

export function uploadSource() {
  if (!media.ready) return;
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, sourceTex);
  try {
    if (media.viaCanvas) {
      scratchCtx.drawImage(media.el, 0, 0, scratch.width, scratch.height);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, scratch);
    } else {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, media.el);
    }
  } catch {
    toast("The GPU refused that image");
    media.ready = false;
    return;
  }
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
}
