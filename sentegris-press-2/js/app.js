import { P } from "./state.js";
import { COLORBAR } from "./config.js";
import { startLoop } from "./renderer.js";
import { syncUI, setActivePlate, noneBtn, resetAll } from "./panels.js";
import { loadFile } from "./media.js";
import { loadTestForm } from "./test-form.js";
import { savePng } from "./export.js";

const $ = id => document.getElementById(id);

/* ── loading art ──────────────────────────────────────────────── */
const fileInput = $("file");
const drop = $("drop");

$("pick").addEventListener("click", () => fileInput.click());
drop.addEventListener("click", () => fileInput.click());
drop.addEventListener("keydown", e => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    fileInput.click();
  }
});
fileInput.addEventListener("change", () => {
  loadFile(fileInput.files[0]);
  fileInput.value = "";        /* so the same file can be picked twice in a row */
});
$("demo").addEventListener("click", loadTestForm);

for (const type of ["dragenter", "dragover"]) {
  window.addEventListener(type, e => {
    e.preventDefault();
    drop.classList.add("hot");
  });
}
for (const type of ["dragleave", "drop"]) {
  window.addEventListener(type, e => {
    e.preventDefault();
    if (type === "drop" || e.target === document.documentElement) drop.classList.remove("hot");
  });
}
window.addEventListener("drop", e => {
  const f = e.dataTransfer?.files[0];
  if (f) loadFile(f);
});
window.addEventListener("paste", e => {
  for (const item of e.clipboardData?.items ?? []) {
    if (item.type.startsWith("image/")) {
      loadFile(item.getAsFile());
      break;
    }
  }
});

/* ── run ──────────────────────────────────────────────────────── */
$("savePng").addEventListener("click", savePng);
$("reset").addEventListener("click", resetAll);

window.addEventListener("keydown", e => {
  if (e.target.matches("input,select,textarea")) return;
  if (e.key.toLowerCase() === "s" && (e.metaKey || e.ctrlKey)) {
    e.preventDefault();
    savePng();
  }
});

/* ── stage chrome ─────────────────────────────────────────────── */
const colorbar = $("colorbar");
for (const c of COLORBAR) {
  const i = document.createElement("i");
  i.style.background = c;
  colorbar.append(i);
}

/* ── boot ─────────────────────────────────────────────────────── */
syncUI();
if (P.bypass) setActivePlate(noneBtn);
loadTestForm();
startLoop();
