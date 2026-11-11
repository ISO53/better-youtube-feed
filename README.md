<p align="center">
	<img width="100%" src="public/icon/icon.svg">
</p>

<p align="center">
    <b>Better Youtube Feed</b> - Hide what you've already watched and teach YouTube what you keep ignoring.
</p>

A browser extension that stops YouTube from showing you videos you've already watched or keep ignoring without opening and, optionally, sends YouTube's own "Not interested" feedback for them so the recommender learns to replace them with fresh ones over time.

All data stays in the browser. There is no server and no telemetry.

## Development

```bash
npm install        # install dependencies
npm run dev        # dev server + extension auto-loaded into a Chromium instance
npm run build      # production build into .output/chrome-mv3
npm run zip        # packaged .zip for store upload
```

## License

[GPL-3.0](./LICENSE)
