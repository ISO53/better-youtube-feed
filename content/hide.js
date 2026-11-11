// Hiding layer: toggles a CSS class on cards per the hide decision.
// Scans re-apply the decision, so threshold changes un-hide automatically.

import { browser } from 'wxt/browser';

import { DEFAULT_SETTINGS, getSettings } from '../lib/settings.js';

const HIDDEN_CLASS = 'byf-hidden';

let settings = { ...DEFAULT_SETTINGS };

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

/**
 * Hide/unhide one card for the given video info.
 * @param {Element} card
 * @param {{watched: boolean, watchedPct: number|null}} info - from extractVideoInfo
 * @returns {boolean} true when the card is (now) hidden
 */
export function applyHiding(card, info) {
	// Whitelist check will live here (M3/M4): whitelisted videos never hide.
	// pct > 0 keeps zero-progress bars unhidden even at a 0% threshold.
	const hide =
		settings.hideWatched &&
		info.watchedPct > 0 &&
		info.watchedPct >= settings.watchedThresholdPct;
	card.classList.toggle(HIDDEN_CLASS, hide);
	return hide;
}
