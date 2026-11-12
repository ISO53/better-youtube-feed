// Content-script pipeline: collects discovered cards into session records,
// batches them to the background (IDB merge in lib/db.js).
// Collection is discovery-based (hidden and off-screen cards included);
// exposure counting is delegated to an IntersectionObserver.

import { browser } from 'wxt/browser';

import { findVideoCards, extractVideoInfo, currentSurface } from './extract.js';
import { applyHiding, initHider, setWhitelist } from './hide.js';

const SCAN_INTERVAL_MS = 3000;
const FLUSH_DELAY_MS = 150;
// Don't recount the same video within this window across overlapping triggers.
const RECOUNT_WINDOW_MS = 1000;
// A card counts as seen when at least this fraction is visible.
const VISIBLE_RATIO = 0.5;

/**
 * Start watching the page. Cleans itself up when the content script is invalidated.
 * @param {import('wxt/utils/content-script-context').ContentScriptContext} ctx
 */
export function startFeedWatcher(ctx) {
	const session = new Map(); // videoId -> session record
	const observedCards = new Map(); // card element -> videoId (grows per page session)
	const dirty = new Set(); // session records with unsent changes
	const pendingRoots = new Set();
	let flushTimer = null;

	// Exposure: the observer reports every real visibility change, including
	// cards that flash past between scans. Hidden (display:none) cards never
	// intersect, so they never count as seen.
	const exposure = new IntersectionObserver(
		(entries) => {
			const now = Date.now();
			for (const entry of entries) {
				if (!entry.isIntersecting || entry.intersectionRatio < VISIBLE_RATIO) continue;
				const rec = session.get(observedCards.get(entry.target));
				if (!rec || now - rec.lastSeen < RECOUNT_WINDOW_MS) continue;
				rec.lastSeen = now;
				rec.seenCountDelta++;
				dirty.add(rec);
			}
			flushDirty();
		},
		{ threshold: [VISIBLE_RATIO] },
	);

	function flushDirty() {
		if (dirty.size === 0) return;
		const records = [...dirty];
		dirty.clear();
		// Fire-and-forget; the background script acknowledges nothing.
		browser.runtime
			.sendMessage({
				type: 'videos/upsert',
				videos: records.map((rec) => ({ ...rec })),
			})
			.catch(() => {});
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

	// Discovery + hiding. Runs for every discovered card regardless of
	// visibility: below-fold cards are hidden before the user scrolls to them,
	// and hidden cards still get their (review-page) record.
	function scan(root) {
		const surface = currentSurface();
		const now = Date.now();

		for (const [videoId, card] of findVideoCards(root)) {
			const info = extractVideoInfo(card);
			const hidden = applyHiding(card, info, videoId);

			// Observe each card element once; recycled elements update their id.
			if (!observedCards.has(card)) exposure.observe(card);
			observedCards.set(card, videoId);

			const rec = session.get(videoId);
			if (!rec) {
				const fresh = {
					videoId,
					...info,
					hidden,
					hiddenReason: hidden ? 'watched' : null,
					surface,
					firstSeen: now,
					lastSeen: 0, // exposure observer sets this on first real sighting
					seenCountDelta: 0, // counted by the observer, not by discovery
				};
				session.set(videoId, fresh);
				dirty.add(fresh);
				continue;
			}

			// Existing record: refresh cheap fields; re-extract details only
			// while they are still incomplete or the video is not watched yet.
			let changed = false;
			if (rec.surface !== surface) {
				rec.surface = surface;
				changed = true;
			}
			if (!rec.title || !rec.channel || !rec.watched) {
				for (const key of ['title', 'channel', 'watched', 'watchedPct']) {
					if (info[key] && info[key] !== rec[key]) {
						rec[key] = info[key];
						changed = true;
					}
				}
			}
			if (rec.hidden !== hidden) {
				rec.hidden = hidden;
				rec.hiddenReason = hidden ? 'watched' : null;
				changed = true;
			}
			if (changed) dirty.add(rec);
		}

		flushDirty();
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

	// Live whitelist updates pushed by the background script.
	const onRuntimeMessage = (message) => {
		if (message?.type !== 'whitelist/updated') return;
		setWhitelist(message.ids ?? []);
		scan(document);
	};
	browser.runtime.onMessage.addListener(onRuntimeMessage);

	async function loadWhitelist() {
		try {
			const res = await browser.runtime.sendMessage({ type: 'whitelist/get' });
			setWhitelist(res?.ids ?? []);
		} catch {
			// extension context gone; nothing to do
		}
	}

	function stop() {
		observer.disconnect();
		exposure.disconnect();
		clearInterval(intervalId);
		clearTimeout(flushTimer);
		document.removeEventListener('yt-navigate-finish', onNavigated);
		browser.runtime.onMessage.removeListener(onRuntimeMessage);
	}
	ctx.onInvalidated(stop);

	// Initial sweep needs settings AND whitelist first, so flagged videos
	// don't flash hidden before their first scan.
	initHider().then(loadWhitelist).finally(() => scan(document));
	return stop;
}
