/* A fatal error takes down the tool, not the page it is embedded in. The
   original replaced document.body, which would wipe a host site's markup. */
export function fatal(title, detail) {
  const host = document.getElementById("halftone-press") || document.body;
  const box = document.createElement("div");
  box.style.cssText =
    "font-family:ui-monospace,Menlo,monospace;padding:36px;color:#1a1815;" +
    "max-width:900px;line-height:1.6;font-size:12px";

  const head = document.createElement("b");
  head.style.fontSize = "15px";
  head.textContent = title;
  box.append(head);

  if (detail) {
    const pre = document.createElement("pre");
    pre.style.cssText = "white-space:pre-wrap;background:rgba(0,0,0,.12);padding:14px;margin-top:14px";
    pre.textContent = String(detail);   /* textContent, so nothing can be injected */
    box.append(pre);
  }

  host.replaceChildren(box);
  return new Error(title + (detail ? ": " + detail : ""));
}
