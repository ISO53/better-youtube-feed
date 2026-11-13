// Watch recorder: marks videos as watched when the furthest playback position
// reaches the user's watched threshold. Scrubbing forward counts immediately;
// scrubbing backward never lowers the progress. Live streams are skipped.

import { browser } from 'wxt/browser';

import { getSettings } from '../lib/settings.js';

const MAIN_VIDEO_SELECTOR = '#movie_player video.html5-main-video';

/**
 * Start recording watches on /watch pages. Cleans itself up on invalidation.
 * @param {import('wxt/utils/content-script-context').ContentScriptContext} ctx
 */
export function startRecorder(ctx) {
	let thresholdPct = 50;
	let enabled = true;
	let watchPageOn = true; // enabledSurfaces.watch
	let currentVideoId = null;
	let maxPct = 0;
	let marked = false;
	let videoEl = null;

	// Settings apply live; mid-watch changes take effect on the next event.
	getSettings().then((s) => {
		thresholdPct = s.watchedThresholdPct;
		enabled = s.recordWatches;
		watchPageOn = s.enabledSurfaces?.watch ?? true;
	});
	browser.storage.onChanged.addListener((changes, area) => {
		if (area !== 'local' || !changes.settings) return;
		const next = changes.settings.newValue;
		thresholdPct = next?.watchedThresholdPct ?? thresholdPct;
		enabled = next?.recordWatches ?? enabled;
		watchPageOn = next?.enabledSurfaces?.watch ?? true;
	});

	function onPositionEvent() {
		if (!videoEl || marked || !enabled || !watchPageOn) return;
		const { currentTime, duration } = videoEl;
		if (!Number.isFinite(duration) || duration <= 0) return; // live / unknown
		const pct = (currentTime / duration) * 100;
		if (pct > maxPct) maxPct = pct;
		if (maxPct >= thresholdPct) {
			marked = true;
			browser.runtime
				.sendMessage({
					type: 'video/watched',
					videoId: currentVideoId,
					pct: Math.round(maxPct),
					...extractWatchMeta(),
				})
				.catch((err) => console.error('[byf] watched report failed:', err));
		}
	}

	function extractWatchMeta() {
		const title = document.querySelector('h1.ytd-watch-metadata yt-formatted-string')
			?.textContent?.trim();
		const channel = document.querySelector('ytd-channel-name a')?.textContent?.trim();
		return { title: title || '', channel: channel || '' };
	}

	function attach() {
		const el = document.querySelector(MAIN_VIDEO_SELECTOR);
		if (el === videoEl) return;
		if (videoEl) {
			videoEl.removeEventListener('timeupdate', onPositionEvent);
			videoEl.removeEventListener('seeked', onPositionEvent);
		}
		videoEl = el;
		if (el) {
			el.addEventListener('timeupdate', onPositionEvent);
			el.addEventListener('seeked', onPositionEvent);
		}
	}

	function syncTarget() {
		const id = videoIdFromUrl(location.href);
		if (id === currentVideoId) return;
		currentVideoId = id;
		maxPct = 0;
		marked = false;
	}

	// The main <video> element is reused across SPA navigations, but YouTube
	// can also replace it — re-check on navigation and when detached.
	const onNavigated = () => {
		syncTarget();
		attach();
	};
	document.addEventListener('yt-navigate-finish', onNavigated);
	const intervalId = setInterval(() => {
		if (!currentVideoId) syncTarget();
		if (currentVideoId && (!videoEl || !videoEl.isConnected)) attach();
	}, 1000);

	ctx.onInvalidated(stop);
	onNavigated();

	function stop() {
		clearInterval(intervalId);
		document.removeEventListener('yt-navigate-finish', onNavigated);
		if (videoEl) {
			videoEl.removeEventListener('timeupdate', onPositionEvent);
			videoEl.removeEventListener('seeked', onPositionEvent);
		}
	}
	return stop;
}

/** /watch?v=abc... -> abc, or null on other surfaces. */
function videoIdFromUrl(href) {
	const match = /[?&]v=([a-zA-Z0-9_-]{11})/.exec(href);
	return match ? match[1] : null;
}
