// Card discovery + info extraction for YouTube feed surfaces.
// Strategy (per research): anchor-driven discovery — query watch-links and
// climb to the outer card container; selector cascades for title/channel;
// watched state read from the card's Polymer `.data` with DOM fallbacks.
// Every selector lives in this file so layout churn is fixed in one place.

// Ordered outer-container-first: hiding/reading on the outer wrapper avoids
// empty grid slots when YouTube nests the new yt-lockup-view-model inside.
const CARD_CONTAINERS = [
	'ytd-rich-item-renderer',
	'ytd-video-renderer',
	'ytd-compact-video-renderer',
	'ytd-grid-video-renderer',
	'ytd-playlist-video-renderer',
	'yt-lockup-view-model',
].join(',');

// Cards that hold watch-links but are not feed videos.
const CARD_EXCLUDES = 'ytd-ad-slot-renderer, ytd-comment-thread-renderer, ytd-comment-renderer';

// Title: new lockup headings first, then classic renderer ids, then attributes.
const TITLE_SELECTORS = [
	'.yt-lockup-metadata-view-model__heading',
	'h3 a#video-title',
	'a#video-title',
	'#video-title',
	'h3 a',
	'a[title]',
];

// Channel name: new metadata row first, then classic #channel-name.
const CHANNEL_SELECTORS = [
	'yt-content-metadata-view-model a',
	'#channel-name a',
	'.yt-lockup-metadata-view-model__metadata a',
];

// Watched progress bars in the DOM (new view-model class + legacy id).
const WATCHED_BAR_SELECTORS = [
	'.ytThumbnailOverlayProgressBarHostWatchedProgressBarSegment',
	'ytd-thumbnail-overlay-resume-playback-renderer #progress',
].join(',');

/**
 * Find video cards under `root`.
 * @param {ParentNode} root - element or document to scan
 * @returns {Map<string, Element>} videoId -> card element
 */
export function findVideoCards(root) {
	const cards = new Map();
	if (!root.querySelectorAll) return cards;
	const anchors = root.querySelectorAll('a[href*="/watch?v="]');
	for (const anchor of anchors) {
		const videoId = videoIdFromHref(anchor.getAttribute('href') || '');
		if (!videoId) continue;
		const card = anchor.closest(CARD_CONTAINERS);
		if (!card || card.closest(CARD_EXCLUDES)) continue;
		if (!cards.has(videoId)) cards.set(videoId, card);
	}
	return cards;
}

/**
 * Extract what we know about a card.
 * @returns {{title: string, channel: string, watched: boolean, watchedPct: number|null}}
 */
export function extractVideoInfo(card) {
	const watchedPct = findWatchedPct(card);
	return {
		title: extractText(card, TITLE_SELECTORS),
		channel: extractText(card, CHANNEL_SELECTORS),
		watched: watchedPct != null && watchedPct > 0,
		watchedPct,
	};
}

/** Which feed surface are we on right now. */
export function currentSurface() {
	const path = location.pathname;
	if (path === '/') return 'home';
	if (path === '/feed/subscriptions') return 'subscriptions';
	if (path === '/results') return 'search';
	if (path.startsWith('/watch')) return 'watch';
	return 'other';
}

/** "/watch?v=abc12345678&..." -> "abc12345678" (11 chars), or null. */
function videoIdFromHref(href) {
	const match = /[?&]v=([a-zA-Z0-9_-]{11})/.exec(href);
	return match ? match[1] : null;
}

/** First selector that yields non-empty text wins; title attr beats textContent. */
function extractText(card, selectors) {
	for (const selector of selectors) {
		const el = card.querySelector(selector);
		if (!el) continue;
		const text = (el.getAttribute('title') || el.textContent || '').trim();
		if (text) return text;
	}
	return '';
}

/**
 * Watched percentage, DOM-first.
 *
 * IMPORTANT (worlds): this runs in the content script's ISOLATED world, where
 * page-defined element properties like the Polymer `.data` accessor are
 * undefined. Only plain DOM (elements, attributes, style) is readable here.
 * The `.data` scan below therefore only fires if this code ever moves to a
 * MAIN-world module (planned for token extraction); the progress bar is the
 * signal that works today.
 *
 * @returns {number|null} 0-100, or null when YouTube shows no progress
 */
function findWatchedPct(card) {
	const bar = card.querySelector(WATCHED_BAR_SELECTORS);
	if (bar) {
		const width = parseFloat(bar.style?.width || '');
		if (!Number.isNaN(width)) return width;
	}

	return scanDataForWatched([
		card.data,
		card.querySelector?.('yt-lockup-view-model')?.data,
		card.querySelector?.(':scope > #content')?.data,
	]);
}

// Depth-limited walk for the two known progress keys anywhere in a card's data.
function scanDataForWatched(dataCandidates) {
	for (const data of dataCandidates) {
		if (!data || typeof data !== 'object') continue;
		let pct = null;
		const seen = new Set();
		(function walk(node, depth) {
			if (pct !== null || !node || typeof node !== 'object' || depth > 14 || seen.has(node)) return;
			seen.add(node);
			if (typeof node.startPercent === 'number') {
				pct = node.startPercent;
				return;
			}
			if (typeof node.percentDurationWatched === 'number') {
				pct = node.percentDurationWatched;
				return;
			}
			for (const key of Object.keys(node)) walk(node[key], depth + 1);
		})(data, 0);
		if (pct !== null) return pct;
	}
	return null;
}
