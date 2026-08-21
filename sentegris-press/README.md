# Halftone Press

A browser-based image tool. Drop in artwork, convert it to the house sepia,
optionally screen it into a halftone plate or lay it under a vellum sheet, and
save a PNG.

Everything runs in the visitor's browser. Nothing is uploaded, nothing is stored,
and there is no server-side component.

## Installing

Upload the `halftone-press` folder to the web root, keeping its structure
intact:

```
halftone-press/
  index.html
  styles.css
  js/            15 files
  assets/        2 SVGs + 3 fonts
```

It will be live at `https://yourdomain.com/halftone-press/`.

Every path inside is relative, so the folder can be renamed or moved to any
depth without editing a single file.

**No build step, no dependencies, no package installation.** There is nothing to
compile and no framework to install.

## Server requirements

- **Any web server.** Apache, nginx, IIS, or a static host all work. No PHP, no
  Node, no database.
- **Must be served over HTTP or HTTPS.** The page uses JavaScript modules, which
  browsers refuse to load from a local `file://` path. Opening `index.html` by
  double-clicking it will show a blank panel — this is expected, and not a fault
  in the files.
- **Directory index enabled**, so `/halftone-press/` resolves to `index.html`.
  This is the default nearly everywhere. If your server is configured otherwise,
  the full path `/halftone-press/index.html` works regardless.
- **Default MIME types.** `.js`, `.css`, `.svg` and `.woff2` all need to be
  served as themselves. Every current server does this out of the box; only a
  heavily locked-down IIS configuration is likely to need `.woff2` added.

## Browser requirements

The tool renders on the GPU and needs **WebGL2** — Chrome, Edge, Firefox or
Safari, any version from the last several years. On an unsupported browser it
shows a short explanatory message rather than failing silently.

Best on a desktop or laptop. Below 900px wide the layout stacks the preview
above the controls, which works but is cramped for detailed work.

## Fonts

Three licensed faces ship in `assets/fonts/`, in woff2 only:

| File | Used for |
| --- | --- |
| `syncro-book.woff2` | section headings |
| `wt-garamono-regular.woff2` | the console: labels, values, buttons |
| `post-grotesk-light.woff2` | buttons, dropdowns, and control headings |

These are self-hosted rather than loaded from a third party, so no visitor data
is sent anywhere outside your domain.

The wordmark and the logo are SVG artwork with the type already converted to
outlines, so they render identically whether or not the fonts load.

## Caching

Please don't set long-lived or `immutable` cache headers on `js/` or
`styles.css`. The filenames aren't content-hashed, so aggressive caching means
an updated file may not reach visitors who have used the tool before. Server
defaults are appropriate.

Fonts and the two SVGs in `assets/` are stable and can be cached for as long as
you like.

## Verifying the install

1. Open `https://yourdomain.com/halftone-press/`
2. A test image should appear automatically — a sphere, a graduated sky, and a
   row of grey steps along the bottom
3. Click **Fine** under Plate; the image should resolve into a halftone dot
   pattern
4. Click **Save PNG**; a file should download

If step 2 shows an empty panel, the files are almost certainly being served from
a `file://` path rather than over HTTP.
