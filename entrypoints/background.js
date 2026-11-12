import { browser } from 'wxt/browser';

import {
	getRecorderWatchedIds,
	getWhitelistedIds,
	markVideoWatched,
	upsertVideos,
} from '../lib/db.js';
import { recordVideoEvents, recordWatched } from '../lib/events.js';

export default defineBackground(() => {
	// Single writer: merges content-script batches into IDB, derives log
	// entries + stat counters, and serves/broadcasts per-tab state.
	browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
		if (message?.type === 'videos/upsert') {
			upsertVideos(message.videos)
				.then(recordVideoEvents)
				.catch((err) => console.error('[byf] upsert failed:', err));
		} else if (message?.type === 'video/watched') {
			onWatched(message);
		} else if (message?.type === 'state/get') {
			Promise.all([getWhitelistedIds(), getRecorderWatchedIds()]).then(
				([whitelist, watched]) => sendResponse({ whitelist, watched }),
			);
			return true; // async response
		} else if (message?.type === 'state/changed') {
			broadcastState();
		}
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

	// Push fresh whitelist/watched sets to every YouTube tab so feeds react live.
	async function broadcastState() {
		const [whitelist, watched] = await Promise.all([
			getWhitelistedIds(),
			getRecorderWatchedIds(),
		]);
		const tabs = await browser.tabs.query({});
		for (const tab of tabs) {
			browser.tabs
				.sendMessage(tab.id, { type: 'state/updated', whitelist, watched })
				.catch(() => {});
		}
	}
});
