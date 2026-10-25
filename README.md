# plates.studio

Plain HTML / CSS / JS. No build step.
Layout, type and spacing: Figma "plates.web 🕸️ 1.5" → WIP 10/22 (Desktop 1440 is the source of truth; Mobile 402).

- `index.html` — home page. Class names follow the desktop Figma layer names.
- `privacy.html` — privacy policy (header, sticky footer and footer are copied from `index.html`; keep them in sync)
- `css/styles.css` — themes, tokens and type styles at the top, then sections in page order; mobile overrides at the bottom (one breakpoint, 809px)
- `js/main.js` — clocks, thumbnail height lock, PS-mark theme easter egg, scroll reveal, footer year, email form placeholder
- `js/goo-text.js` — goo hover effect: `data-goo="reveal"` on the XL text, `data-goo="melt"` on each project info row (capabilities opt out with `data-goo-skip`; the description carries its own radius/feather). Tuning attributes are documented at the top of the file.
- `js/globe.js` — wireframe globe (default settings, except `data-globe-stroke="2"` in the HTML). Click drops a dot; dot colour follows the theme via CSS.
- `assets/` — logo and PS mark SVGs (both are also inlined in the HTML)

Preview locally: `npx serve .` in this folder (Adobe Fonts kit dyf7qmw needs `localhost` in its allowed domains). `vercel.json` serves `/privacy` and redirects the old `/info` page to the homepage. Favicons, the share image and the manifest in `assets/` are carried over from the previous site. Untouched: `experiments/` (Emergence) and the `sentegris-press` tools.

Scroll reveal (fade only): `data-reveal`, `data-reveal-group` (children in sequence), `data-reveal-lines` (line by line). Timing lives in the "Scroll reveal" block of `css/styles.css`.

Project media: each thumbnail slot takes an `<img>` or a `<video>` (see the comment above the projects in `index.html`). Videos are silent loops with no controls that play while on screen and fall back to their `poster` frame when autoplay isn't allowed or reduced motion is on. Export them at the slot's aspect ratio as MP4 (H.264) with no audio track; short loops can live in `assets/`, long or heavy films are better on a video host.

FPO: project images are hot-linked from the Framer build; Keena and Witzkaan Events have placeholder copy and grey image slots.

Behaviour notes (QA round 1):
- Touch screens (phones, tablets): "reveal" XL text plays once as an intro sweep (blobby → crisp, left to right) as it fades in, then the plain text takes over. Length: `data-goo-intro` (seconds, default 1.8; `"off"` disables).
- Mobile hero: the XL line and the descriptor stay centred while scrolling and cross-fade (`.hero-scene`, set by `js/main.js`). Scroll length: `--hero-travel` in `styles.css`.
- Cursor (mouse/trackpad): 14px dot drawn by `js/main.js` with a difference blend; colour per theme is `--cursor-color`.
- Globe: line weight 1.5, 14px dots on desktop (~7px on phones), and a dot lands on a random spot every 3 seconds while the globe is on screen.
- Clock colon blinks once a second; the PS mark tilts by itself every 5 seconds on touch screens.
- Desktop ≥1024: the footer's last line sits on the same baseline as the PS mark and ©, so the two read as one footer.
