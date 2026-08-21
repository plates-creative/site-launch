# Halftone Press

A screening console. Art comes in, gets desaturated and mapped through the house
sepia, optionally screened into a halftone plate or laid under a vellum sheet,
and saves out as a PNG. All rendering is WebGL2 — no libraries, no build step.

## Structure

```
index.html            markup only
styles.css            all styling
js/
  app.js              entry point: input wiring, drag/drop/paste, keys, boot
  config.js           press constants: defaults, plates, ratios, palette
  state.js            mutable session state (P, media, dirty flag)
  controls.js         generic control factories + the UI sync registry
  panels.js           builds each console section, presets, readouts
  media.js            file picking, decoding, GPU size clamp
  test-form.js        the procedural 21-step test form
  source-texture.js   the source texture: upload and mipmaps
  gl.js               WebGL2 context, program building, render targets
  shaders.js          all GLSL
  renderer.js         uniforms, the plate/vellum/composite passes, draw loop
  export.js           PNG export at export scale
  toast.js            transient messages
  fatal.js            unrecoverable-error panel
```

Dependencies run one way — `app` → everything, `renderer` → `gl` → `shaders`,
with `config`, `shaders`, `toast` and `fatal` as leaves. There are no cycles, so
the modules can be reordered or bundled without surprises.

**Single source of truth:** `P` in `state.js` is the only settings object. Every
control registers a `sync()` under its key in `UI`, so `syncUI()` pushes all of
`P` back into the console after a preset or reset. Adding a setting means adding
it to `DEFAULTS` and adding one control — nothing else.

## What changed from the original

Behaviour is unchanged. Every GLSL operation, constant and expression is the
original — those were clearly fitted against a reference and I didn't touch
them. The only edit inside a shader is one stray double blank line removed.

Fixed:

- **Name collision.** A module-level `pc` formatter and a local `pc` paper colour
  inside `render()` shadowed each other. Harmless in one file, a live bug the
  moment the code is split. Renamed to `pct` and `paperRGB`.
- **Export could freeze the preview.** If `toBlob` returned nothing or the render
  threw, the `exporting` flag stayed set and the canvas never redrew again.
  Restore now always runs.
- **`document.body.innerHTML` wipe.** The no-WebGL2 and shader-failure paths
  replaced the entire page body. Now scoped to the tool's own container, so it
  can't take a host page down with it.
- **Filename injected as HTML.** The metadata line built `innerHTML` from the
  uploaded file's name. Now `textContent`.
- **Blob URL leak.** The object URL created per upload was only revoked on the
  error path. Now revoked on success too.

Removed dead code: `seed`, the `f1` and `sg` formatters, the `touched` alias,
and the "RECORD" in a section header for a feature that isn't there. Inline
`style=""` attributes moved into classes.

A later audit pass removed the rest: the `button[disabled]` rule (no button is
ever disabled), `.chip { position: relative }` and `.bar { gap: 0 }` and
`canvas#out { image-rendering: auto }` (all no-ops), `.btns.three` and
`.presets button.none` (dead selectors), and the two unreferenced `id`
attributes in the markup. `draw()` is no longer exported — only the loop uses it.

Added: `type="button"` on console buttons, `aria-label` on the canvas, and
`role="status" aria-live="polite"` on the toast so screen readers announce it.

## Accessibility

Every text colour clears WCAG AA (4.5:1) on its own background, and focus rings
clear 3:1. The muted tiers are `--dim` at 5.09:1 and `--dimmer` at 4.59:1 —
`--dimmer` carries real content (plate notes, file metadata, accepted formats),
so it is held above the floor rather than treated as decoration. `--dim` is
deliberately not pushed higher: at L\* 60 the preset states still rise in
lightness, rest → selected → hover.

Every interactive control has both a hover and a focus-visible state. Two needed
special handling: `.presets button` sets `border: 0`, so its outline is inset;
and `.drop` is a `div` with `role="button"`, which no `button` rule reaches.

Selection state is not carried by colour alone. The swatches and presets set
`aria-pressed`, and the selected preset also shows a 2px rule — a shape cue, so
it survives both colourblindness and the fact that Seafoam and `--dim` sit at
similar lightness. The toast is `role="status"`, and the file-metadata line is
`aria-live="polite"` so a loaded file is announced.

Nothing renders below 10px. A `prefers-reduced-motion` block collapses the two
transitions in the tool.

## Deploying (GitHub → Vercel)

This is a standalone page that owns its viewport: `.shell` is `height: 100vh`
with a fixed 352px rail, collapsing to a stacked layout under 900px. The CSS is
deliberately unscoped — it styles bare `section`, `button`, `select` and
`input[type=range]`, which is fine on a page it owns and would collide inside a
shared template. Keep it on its own route.

Commit the whole folder into the repo:

```
tools/halftone-press/
```

That serves at `/tools/halftone-press/` — Vercel's static hosting resolves a
directory to its `index.html`. Every path in here is relative, so the folder can
be renamed or moved without touching a line of code. No `vercel.json` and no
build step required.

**Don't add cache headers.** The filenames aren't content-hashed, so an
`immutable` `Cache-Control` on `js/` or `styles.css` means a fix ships and
nobody sees it. Vercel's defaults are correct here — this is worth saying out
loud because adding aggressive caching is the reflexive move and it's the wrong
one without hashed filenames.

**OG image:** the head has Open Graph tags but no `og:image`. Add one before
sharing the link anywhere — a saved export from the tool itself would do it.

**Local preview** needs a server, since ES modules won't load over `file://`:

```
cd tools/halftone-press && python3 -m http.server 8000
```
