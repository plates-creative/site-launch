import { P, mark } from "./state.js";
import { DEFAULTS } from "./config.js";

/* Every control registers a sync() here under its parameter key, so syncUI()
   can push the whole of P back into the console after a preset or a reset. */
export const UI = {};

/* Fit, Ink and Run are orthogonal to the plate: they change how the art sits and
   what colour it prints, not which screen is on it. So touching a control
   redraws but leaves the plate selection alone — only the plate buttons change
   plates. */
let changeHook = () => {};
export function setChangeHook(fn) { changeHook = fn; }

function touched() {
  mark();
  changeHook();
}

export function el(tag, cls, html) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html != null) n.innerHTML = html;
  return n;
}

export function range(key, label, min, max, step, fmt) {
  const row = el("div", "row");
  const lab = el("div", "lab");
  const value = el("b");
  lab.append(el("span", null, label), value);

  const input = el("input");
  input.type = "range";
  input.min = min;
  input.max = max;
  input.step = step;
  input.setAttribute("aria-label", label);

  const apply = () => { UI[key].sync(); touched(); };
  input.addEventListener("input", () => { P[key] = parseFloat(input.value); apply(); });
  /* double click a slider to put it back to the press default */
  input.addEventListener("dblclick", () => { P[key] = DEFAULTS[key]; apply(); });

  row.append(lab, input);
  UI[key] = {
    sync() {
      input.value = P[key];
      value.textContent = fmt ? fmt(P[key]) : P[key];
    }
  };
  return row;
}

export function select(key, label, opts, onChange) {
  const row = el("div", "row");
  const lab = el("div", "lab");
  lab.append(el("span", null, label));
  row.append(lab);

  const sel = el("select");
  sel.setAttribute("aria-label", label);
  for (const [value, text] of opts) {
    const o = el("option");
    o.value = value;
    o.textContent = text;
    sel.append(o);
  }
  sel.addEventListener("change", () => {
    /* numeric options ("0"/"1") come back as numbers, named ones ("16:9") as strings */
    const n = Number(sel.value);
    P[key] = (sel.value !== "" && !Number.isNaN(n)) ? n : sel.value;
    touched();
    if (onChange) onChange();
  });

  row.append(sel);
  UI[key] = { sync() { sel.value = P[key]; } };
  return row;
}

export function toggleGroup(list) {
  const wrap = el("div", "toggles");
  for (const [key, label, onChange] of list) {
    const l = el("label", "tg");
    const input = el("input");
    input.type = "checkbox";
    l.append(input, el("i"), document.createTextNode(label));
    input.addEventListener("change", () => {
      P[key] = input.checked;
      l.classList.toggle("on", input.checked);
      touched();
      if (onChange) onChange(input.checked);
    });
    wrap.append(l);
    UI[key] = {
      sync() {
        input.checked = !!P[key];
        l.classList.toggle("on", !!P[key]);
      }
    };
  }
  const row = el("div", "row");
  row.append(wrap);
  return row;
}

/* a named swatch row: the palette is fixed, so these are the only inks there are */
export function swatchRow(key, label, opts) {
  const row = el("div", "row");
  const lab = el("div", "lab");
  const name = el("b");
  lab.append(el("span", null, label), name);

  const wrap = el("div", "chips");
  const chips = opts.map(([value, title]) => {
    const c = el("button", "chip");
    c.type = "button";
    c.title = title;
    c.setAttribute("aria-label", title);
    if (value === "none") c.classList.add("none");
    else c.style.background = value;
    c.setAttribute("aria-pressed", "false");
    c.addEventListener("click", () => { P[key] = value; UI[key].sync(); touched(); });
    wrap.append(c);
    return { value, chip: c, title };
  });

  row.append(lab, wrap);
  UI[key] = {
    sync() {
      for (const { value, chip } of chips) {
        const on = P[key] === value;
        chip.classList.toggle("on", on);
        /* the selected swatch is otherwise signalled only by a border colour */
        chip.setAttribute("aria-pressed", String(on));
      }
      const hit = chips.find(c => c.value === P[key]);
      name.textContent = hit ? hit.title : "";
    }
  };
  return row;
}

/* value formatters */
export const f2 = v => v.toFixed(2);
export const pct = v => Math.round(v * 100) + "%";
