// Hiding layer: toggles a CSS class on cards per the hide decision.
// Scans re-apply the decision, so threshold and whitelist changes un-hide
// automatically.

import { browser } from 'wxt/browser';

import { DEFAULT_SETTINGS, getSettings } from '../lib/settings.js';

const HIDDEN_CLASS = 'byf-hidden';

let settings = { ...DEFAULT_SETTINGS };
const whitelist = new Set(); // videoIds flagged "never hide" by the user

/**
 * Inject the hiding stylesheet and load current settings.
 * Call once from the pipeline before the first scan.
 */
export async function initHider() {
	const style = document.createElement('style');
	style.id = 'byf-hide-style';
	style.textContent = `.${HIDDEN_CLASS} { display: none !important; }`;
	document.documentElement.appendChild(style);

	settings = await getSettings();
	browser.storage.onChanged.addListener((changes, area) => {
		if (area !== 'local' || !changes.settings) return;
		settings = { ...DEFAULT_SETTINGS, ...changes.settings.newValue };
	});
}

/** Replace the never-hide set (pushed by the background script). */
export function setWhitelist(ids) {
	whitelist.clear();
	for (const id of ids) whitelist.add(id);
}

/**
 * Hide/unhide one card for the given video info.
 * @param {Element} card
 * @param {{watched: boolean, watchedPct: number|null}} info - from extractVideoInfo
 * @param {string} videoId
 * @returns {boolean} true when the card is (now) hidden
 */
export function applyHiding(card, info, videoId) {
	// pct > 0 keeps zero-progress bars unhidden even at a 0% threshold.
	const hide =
		settings.hideWatched &&
		!whitelist.has(videoId) &&
		info.watchedPct > 0 &&
		info.watchedPct >= settings.watchedThresholdPct;
	card.classList.toggle(HIDDEN_CLASS, hide);
	return hide;
}
