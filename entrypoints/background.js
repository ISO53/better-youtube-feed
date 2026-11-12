import { browser } from 'wxt/browser';

import {
	getIgnoredIds,
	getRecorderWatchedIds,
	getWhitelistedIds,
	markVideoWatched,
	upsertVideos,
} from '../lib/db.js';
import { recordVideoEvents, recordWatched } from '../lib/events.js';
import { getSettings } from '../lib/settings.js';

export default defineBackground(() => {
	// Single writer: merges content-script batches into IDB, derives log
	// entries + stat counters, and serves/broadcasts per-tab state.
	console.debug(`[byf] background v${browser.runtime.getManifest().version} started`);
	let lastIgnoredKey = '';

	browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
		if (message?.type === 'videos/upsert') {
			upsertVideos(message.videos)
				.then(recordVideoEvents)
				.then(() => syncIgnoredState())
				.catch((err) => console.error('[byf] upsert failed:', err));
		} else if (message?.type === 'video/watched') {
			onWatched(message);
		} else if (message?.type === 'state/get') {
			Promise.all([getWhitelistedIds(), getRecorderWatchedIds(), currentIgnored()]).then(
				([whitelist, watched, ignored]) => sendResponse({ whitelist, watched, ignored }),
			);
			return true; // async response
		} else if (message?.type === 'state/changed') {
			broadcastState();
		}
	});

	// Threshold/window changes re-evaluate which videos count as ignored.
	browser.storage.onChanged.addListener((changes, area) => {
		if (area === 'local' && changes.settings) syncIgnoredState();
	});

	async function onWatched(message) {
		try {
			const first = await markVideoWatched(message);
			if (first) {
				await recordWatched({ videoId: message.videoId, title: message.title }, message.pct);
				await broadcastState();
			}
		} catch (err) {
			console.error('[byf] watched handling failed:', err);
		}
	}

	async function currentIgnored() {
		const settings = await getSettings();
		if (!settings.hideIgnored) return [];
		return getIgnoredIds(settings.ignoreThreshold, settings.ignoreWindowDays);
	}

	// Broadcast only when the ignored set actually changed (upserts are frequent).
	async function syncIgnoredState() {
		const ignored = await currentIgnored();
		const key = ignored.join(',');
		if (key === lastIgnoredKey) return;
		lastIgnoredKey = key;
		await broadcastState(ignored);
	}

	// Push fresh whitelist/watched/ignored sets to every YouTube tab.
	async function broadcastState(ignored) {
		const [whitelist, watched, ignoredSet] = await Promise.all([
			getWhitelistedIds(),
			getRecorderWatchedIds(),
			ignored ?? currentIgnored(),
		]);
		lastIgnoredKey = ignoredSet.join(',');
		const tabs = await browser.tabs.query({});
		for (const tab of tabs) {
			browser.tabs
				.sendMessage(tab.id, { type: 'state/updated', whitelist, watched, ignored: ignoredSet })
				.catch(() => {});
		}
	}
});
