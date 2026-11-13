// Content-script pipeline: collects discovered cards into session records,
// batches them to the background (IDB merge in lib/db.js).
// Collection is discovery-based (hidden and off-screen cards included);
// exposure counting is delegated to an IntersectionObserver.

import { browser } from 'wxt/browser';

import { requestTokens, sendNotInterested } from './bridge.js';
import { findVideoCards, extractVideoInfo, currentSurface } from './extract.js';
import {
	applyHiding,
	clearHiding,
	initHider,
	isSurfaceEnabled,
	setIgnored,
	setRecorderWatched,
	setWhitelist,
} from './hide.js';

const SCAN_INTERVAL_MS = 3000;
const FLUSH_DELAY_MS = 150;
// A card counts as seen when at least this fraction is visible.
const VISIBLE_RATIO = 0.5;
// A sighting shorter than this is a scroll blip and never counts.
const MIN_SIGHTING_MS = 1000;
// At most one counted exposure per video in this window.
const EXPOSURE_DEDUP_MS = 60_000;

/**
 * Start watching the page. Cleans itself up when the content script is invalidated.
 * @param {import('wxt/utils/content-script-context').ContentScriptContext} ctx
 */
export function startFeedWatcher(ctx) {
	const session = new Map(); // videoId -> session record
	const observedCards = new Map(); // card element -> videoId (grows per page session)
	const dirty = new Set(); // session records with unsent changes
	const feedbackConsidered = new Set(); // videoIds already offered for feedback
	const pendingRoots = new Set();
	let flushTimer = null;

	// Exposure = distinct sightings, not raw visibility ticks. A sighting
	// starts when the card crosses into view and counts (once) when it leaves,
	// if it stayed long enough; ratio oscillation around the threshold can't
	// inflate the count, and hidden cards never intersect at all.
	const inView = new Map(); // card element -> sighting start timestamp
	const exposure = new IntersectionObserver(
		(entries) => {
			const now = Date.now();
			// Sightings never count while the current surface is disabled;
			// open sightings are dropped so re-enabling starts clean.
			if (!isSurfaceEnabled(currentSurface())) {
				inView.clear();
				return;
			}
			for (const entry of entries) {
				const card = entry.target;
				const visible = entry.isIntersecting && entry.intersectionRatio >= VISIBLE_RATIO;
				const sighting = inView.get(card);

				if (visible && !sighting) {
					inView.set(card, now);
				} else if (!visible && sighting) {
					inView.delete(card);
					if (now - sighting < MIN_SIGHTING_MS) continue;
					const rec = session.get(observedCards.get(card));
					if (!rec || now - rec.lastSeen < EXPOSURE_DEDUP_MS) continue;
					rec.lastSeen = now;
					rec.seenCountDelta++;
					dirty.add(rec);
				}
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

		// Disabled surface: the extension is off here. Cards stay visible
		// (stale hide classes get cleared) and nothing is collected.
		if (!isSurfaceEnabled(surface)) {
			for (const [, card] of findVideoCards(root)) clearHiding(card);
			flushDirty();
			return;
		}

		const now = Date.now();
		for (const [videoId, card] of findVideoCards(root)) {
			const info = extractVideoInfo(card);
			const hiddenReason = applyHiding(card, info, videoId);
			const hidden = hiddenReason != null;

			// Observe each card element once; recycled elements update their id.
			if (!observedCards.has(card)) exposure.observe(card);
			observedCards.set(card, videoId);

			const rec = session.get(videoId);
			if (!rec) {
				const fresh = {
					videoId,
					...info,
					hidden,
					hiddenReason,
					surface,
					firstSeen: now,
					lastSeen: 0, // exposure observer sets this on first real sighting
					seenCountDelta: 0, // counted by the observer, not by discovery
				};
				session.set(videoId, fresh);
				dirty.add(fresh);
				if (hidden) considerFeedback(videoId, fresh.title, hiddenReason);
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
			if (rec.hidden !== hidden || rec.hiddenReason !== hiddenReason) {
				rec.hidden = hidden;
				rec.hiddenReason = hiddenReason;
				changed = true;
				if (hidden) considerFeedback(videoId, rec.title, hiddenReason);
			}
			if (changed) dirty.add(rec);
		}

		flushDirty();
	}

	// Offer a newly hidden video to the background for a feedback send;
	// tokens are captured fresh from the (still present) card element.
	function considerFeedback(videoId, title, reason) {
		if (feedbackConsidered.has(videoId)) return;
		feedbackConsidered.add(videoId);
		requestTokens(videoId)
			.then((tokens) => {
				if (!tokens) {
					console.warn('[byf] no feedback tokens for', videoId);
					return;
				}
				return browser.runtime.sendMessage({
					type: 'feedback/consider',
					videoId,
					title,
					kind: reason,
					tokens,
				});
			})
			.then(() => drainFeedback())
			.catch((err) => console.warn('[byf] feedback consider failed:', err));
	}

	// Sends queued feedback one at a time through the MAIN-world bridge.
	// Single-flight: many consider-chains can trigger drains concurrently.
	let draining = false;
	async function drainFeedback() {
		if (draining) return;
		draining = true;
		try {
			const res = await browser.runtime.sendMessage({ type: 'feedback/drain' });
			for (const item of res?.pending ?? []) {
				const result = await sendNotInterested(item.tokens, item.type === 'ni_watched');
				if (!result?.ok) {
					console.warn('[byf] feedback send failed for', item.videoId, result?.error);
				}
				await browser.runtime
					.sendMessage({
						type: 'feedback/result',
						videoId: item.videoId,
						title: item.title,
						ok: Boolean(result?.ok),
						withReason: item.type === 'ni_watched',
					})
					.catch((err) => console.warn('[byf] feedback result failed:', err));
			}
		} catch (err) {
			console.warn('[byf] feedback drain failed:', err);
		} finally {
			draining = false;
		}
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

	// Live state (whitelist + recorder-watched + ignored) from the background.
	const onRuntimeMessage = (message) => {
		if (message?.type !== 'state/updated') return;
		setWhitelist(message.whitelist ?? []);
		setRecorderWatched(message.watched ?? []);
		setIgnored(message.ignored ?? []);
		scan(document);
	};
	browser.runtime.onMessage.addListener(onRuntimeMessage);

	async function loadState() {
		try {
			const res = await browser.runtime.sendMessage({ type: 'state/get' });
			setWhitelist(res?.whitelist ?? []);
			setRecorderWatched(res?.watched ?? []);
			setIgnored(res?.ignored ?? []);
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

	// Version stamp: instantly reveals stale builds while testing.
	console.debug(`[byf] feed watcher v${browser.runtime.getManifest().version} started`);

	// Initial sweep needs settings AND state sets first, so whitelisted and
	// recorder-watched videos don't flash hidden before their first scan.
	initHider()
		.then(loadState)
		.finally(() => {
			scan(document);
			drainFeedback(); // items queued before this page loaded
		});
	return stop;
}
