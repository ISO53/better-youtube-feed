// Feed-watching pipeline (content script side).
// Discovers video cards that are actually on screen, keeps one session record
// per video, and ships changes to the background script in batches.
//
// Triggers (belt and braces):
//   - MutationObserver on body, batched through a 150ms pending-roots queue
//   - yt-navigate-finish (YouTube SPA navigation)
//   - 3s interval safety net
//
// Session record = VideoRecord + seenCountDelta (unsent on-screen hits).
// The background script merges records into IndexedDB (see lib/db.js).

import { browser } from 'wxt/browser';

import { findVideoCards, extractVideoInfo, currentSurface } from './extract.js';

const SCAN_INTERVAL_MS = 3000;
const FLUSH_DELAY_MS = 150;
// Don't count the same video again within this window, even if overlapping
// scans (interval + mutation) both catch it.
const RECOUNT_WINDOW_MS = 1000;

/**
 * Start watching the page. Cleans itself up when the content script is
 * invalidated (extension reload).
 * @param {import('wxt/utils/content-script-context').ContentScriptContext} ctx
 */
export function startFeedWatcher(ctx) {
	const session = new Map(); // videoId -> session record
	const pendingRoots = new Set();
	let flushTimer = null;

	function scan(root) {
		const surface = currentSurface();
		const now = Date.now();
		const dirty = [];

		for (const [videoId, card] of findVideoCards(root)) {
			if (!isOnScreen(card)) continue;

			const rec = session.get(videoId);
			if (!rec) {
				const info = extractVideoInfo(card);
				const fresh = {
					videoId,
					...info,
					surface,
					firstSeen: now,
					lastSeen: now,
					seenCountDelta: 1,
				};
				session.set(videoId, fresh);
				dirty.push(fresh);
				continue;
			}

			// Existing record: refresh cheap fields; re-extract details only
			// while they are still incomplete or the video is not watched yet.
			let changed = false;
			if (rec.surface !== surface) {
				rec.surface = surface;
				changed = true;
			}
			if (now - rec.lastSeen >= RECOUNT_WINDOW_MS) {
				rec.lastSeen = now;
				rec.seenCountDelta++;
				changed = true;
			}
			if (!rec.title || !rec.channel || !rec.watched) {
				const info = extractVideoInfo(card);
				for (const key of ['title', 'channel', 'watched', 'watchedPct']) {
					if (info[key] && info[key] !== rec[key]) {
						rec[key] = info[key];
						changed = true;
					}
				}
			}
			if (changed) dirty.push(rec);
		}

		if (dirty.length) sendDirty(dirty);
	}

	function sendDirty(records) {
		// Fire-and-forget; the background script acknowledges nothing.
		browser.runtime
			.sendMessage({
				type: 'videos/upsert',
				videos: records.map((rec) => ({ ...rec })),
			})
			.catch(() => { });
		// The copy above carried the current delta; start counting anew.
		for (const rec of records) rec.seenCountDelta = 0;
	}

	function scheduleFlush(root) {
		pendingRoots.add(root);
		if (flushTimer == null) {
			flushTimer = setTimeout(() => {
				flushTimer = null;
				const roots = [...pendingRoots];
				pendingRoots.clear();
				for (const node of roots) scan(node);
			}, FLUSH_DELAY_MS);
		}
	}

	/** Cheap viewport intersection (IntersectionObserver comes with exposure tracking). */
	function isOnScreen(el) {
		const rect = el.getBoundingClientRect();
		if (rect.width === 0 || rect.height === 0) return false;
		return (
			rect.bottom > 0 &&
			rect.top < window.innerHeight &&
			rect.right > 0 &&
			rect.left < window.innerWidth
		);
	}

	const observer = new MutationObserver((mutations) => {
		for (const mutation of mutations) {
			for (const node of mutation.addedNodes) {
				if (node.nodeType === Node.ELEMENT_NODE) scheduleFlush(node);
			}
		}
	});
	observer.observe(document.body, { childList: true, subtree: true });

	const intervalId = setInterval(() => scan(document), SCAN_INTERVAL_MS);
	const onNavigated = () => scan(document);
	document.addEventListener('yt-navigate-finish', onNavigated);

	function stop() {
		observer.disconnect();
		clearInterval(intervalId);
		clearTimeout(flushTimer);
		document.removeEventListener('yt-navigate-finish', onNavigated);
	}
	ctx.onInvalidated(stop);

	scan(document); // initial sweep
	return stop;
}
