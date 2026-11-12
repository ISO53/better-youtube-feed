// Settings on browser.storage.local; DEFAULTS is the single source of defaults.

/** @typedef {Object} Settings
 * @property {boolean} hideWatched - master switch for hiding watched videos
 * @property {number} watchedThresholdPct - progress that counts as watched (0-100)
 * @property {boolean} recordWatches - master switch for the watch recorder
 * @property {boolean} hideIgnored - master switch for hiding ignored videos
 * @property {number} ignoreThreshold - sightings within the window before hiding
 * @property {number} ignoreWindowDays - sliding exposure window in days
 * @property {boolean} sendFeedback - send YouTube's own Not-interested signal
 */

import { browser } from 'wxt/browser';

const STORAGE_KEY = 'settings';

/** @type {Settings} */
export const DEFAULT_SETTINGS = {
	hideWatched: true,
	watchedThresholdPct: 50,
	recordWatches: true,
	hideIgnored: true,
	ignoreThreshold: 5,
	ignoreWindowDays: 14,
	sendFeedback: true,
};

/** @returns {Promise<Settings>} defaults merged with stored values */
export async function getSettings() {
	const stored = await browser.storage.local.get(STORAGE_KEY);
	return { ...DEFAULT_SETTINGS, ...stored[STORAGE_KEY] };
}

/** @param {Partial<Settings>} patch */
export async function setSettings(patch) {
	const current = await getSettings();
	const next = { ...current, ...patch };
	await browser.storage.local.set({ [STORAGE_KEY]: next });
	return next;
}
