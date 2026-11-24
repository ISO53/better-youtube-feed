<p align="center">
	<img width="20%" src="public/icon/icon.svg">
</p>

<p align="center">
    <b>Better Youtube Feed</b> - Hide what you've already watched and teach YouTube what you keep ignoring.
</p>

<p align="center">
  <a href="https://chromewebstore.google.com/detail/better-youtube-feed/jmbkedkfcoicibohlcaooefcklbenjmn">
    <img src="https://github.com/user-attachments/assets/d0bfb1ea-67d9-4538-97d7-7b66f61423bd" height="75">
  </a>
</p>

A browser extension that stops YouTube from showing you videos you've already watched or keep ignoring without opening and, optionally, sends YouTube's own "Not interested" feedback for them so the recommender learns to replace them with fresh ones over time.

## Features

- **Hide watched videos** - via YouTube's own progress bars and a built-in watch recorder that marks a video watched once you pass your chosen threshold
- **Hide ignored videos** - recommendations that keep reappearing without a single click get hidden after enough sightings within a sliding window
- **Teach the algorithm** - automatically sends YouTube's real "Not interested" signal for hidden videos, and tracks the honor rate so you can see how much YouTube actually respects it
- **Stats dashboard** - how much of your feed was removed and why, whether the feedback sticks, and whether YouTube is learning over time
- **Popup glance** - this week's impact right from the toolbar
- **Full control** - per-surface switches (home, subscriptions, search, watch), hide thresholds, and a whitelist for videos that should never be hidden

## Privacy

All data stays in the browser. There is no server, no telemetry and no accounts. Everything is stored locally in IndexedDB and never leaves your machine.

## Development

```bash
npm install          # install dependencies
npm run dev          # dev server + extension auto-loaded into a Chromium instance
npm run dev:firefox  # same, for Firefox
npm run build        # production build into .output/chrome-mv3
npm run build:firefox  # production build for Firefox
npm run zip          # packaged .zip for store upload
npm run zip:firefox  # packaged Firefox .zip
```

## License

[GPL-3.0](./LICENSE)
