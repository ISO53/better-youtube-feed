// Anchor-driven card discovery + info extraction for YouTube feed surfaces.
// Every selector lives here so layout churn gets fixed in one place.

// closest() returns the NEAREST match, i.e. the inner yt-lockup-view-model on
// home/subs. findVideoCards normalizes up to the outer grid wrapper below.
const CARD_CONTAINERS = [
	'ytd-rich-item-renderer',
	'ytd-video-renderer',
	'ytd-compact-video-renderer',
	'ytd-grid-video-renderer',
	'ytd-playlist-video-renderer',
	'yt-lockup-view-model',
].join(',');

// Wrappers worth hiding in grid surfaces, outermost wins via closest().
const OUTER_CONTAINERS = [
	'ytd-rich-item-renderer',
	'ytd-video-renderer',
	'ytd-compact-video-renderer',
	'ytd-grid-video-renderer',
	'ytd-playlist-video-renderer',
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
		const nearest = anchor.closest(CARD_CONTAINERS);
		if (!nearest || nearest.closest(CARD_EXCLUDES)) continue;
		// Normalize to the outer grid wrapper when one wraps the container.
		const card = nearest.closest(OUTER_CONTAINERS) || nearest;
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
 * Watched percentage: DOM progress bar first, Polymer `.data` scan as fallback.
 * ISOLATED-world note: `.data` is undefined in content scripts; the data scan
 * only pays off if this ever runs in a MAIN-world module.
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
