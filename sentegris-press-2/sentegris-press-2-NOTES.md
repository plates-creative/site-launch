# sentegris-press-2 — notes for the Plates repo

Deliberately outside the `sentegris-press-2/` folder so it is never served.
Anything inside that folder is publicly fetchable once this is live.

## What this is

The Google Fonts build of Halftone Press, for plates.studio. EB Garamond and
DM Mono, both OFL-licensed and self-hosted. The Sentegris build is a separate
bundle set in their licensed faces — do not mix the two.

## Install

Commit `sentegris-press-2/` at the repo root. It serves at
`plates.studio/sentegris-press-2`.

## The `<base href>` line

`index.html` carries `<base href="/sentegris-press-2/">` in the head.

This host serves the page at `/sentegris-press-2` with no trailing slash, so the
browser treats the last segment as a filename and resolves every relative path
against the site root — `styles.css` becomes `/styles.css`, and everything
404s. The base tag re-points them at the folder.

**If the folder is renamed, this line must be renamed with it**, or the page
breaks in exactly that way again.

The alternative — `trailingSlash: true` in the host config — works, but is
site-wide and would start redirecting every other URL on plates.studio.

The Sentegris bundle deliberately has no base tag; their server is unlikely to
behave this way, and the line would be wrong on a different path.

## Verify after pushing

1. Open `plates.studio/sentegris-press-2` — the test form should appear
2. Console clean: no 404s for `styles.css`, `assets/…` or `js/…`
3. On a phone: the preview stays pinned at the top while the rail scrolls, and
   a slider can be dragged with a thumb rather than tapped along
