# Better Youtube Feed

A browser extension that stops YouTube from showing you videos you've already
watched or keep ignoring without opening — and, optionally, sends YouTube's own
"Not interested" feedback for them so the recommender learns to replace them
with fresh ones over time.

All data stays in the browser. There is no server and no telemetry.

**Status: early development.** Nothing works yet — this is the project scaffold.

## Stack

| Area | Choice |
|---|---|
| Language | Plain JavaScript (ES modules) |
| Build | [WXT](https://wxt.dev) with `@wxt-dev/module-vue` |
| UI pages | Vue 3 (`<script setup>`), popup and options only |
| Content scripts, service worker | Vanilla JS, no dependencies |
| Data | `idb` over IndexedDB |
| Charts | Hand-rolled SVG Vue component |

## Development

```bash
npm install        # install dependencies
npm run dev        # dev server + extension auto-loaded into a Chromium instance
npm run build      # production build into .output/chrome-mv3
npm run zip        # packaged .zip for store upload
```

## License

[GPL-3.0](./LICENSE)
