import { browser } from 'wxt/browser';

import { upsertVideos, getWhitelistedIds } from '../lib/db.js';
import { recordVideoEvents } from '../lib/events.js';

export default defineBackground(() => {
	// Single writer: merges batches coming from the content script into IDB,
	// derives log entries + stat counters, and serves whitelist updates.
	browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
		if (message?.type === 'videos/upsert') {
			upsertVideos(message.videos)
				.then(recordVideoEvents)
				.catch((err) => console.error('[byf] upsert failed:', err));
		} else if (message?.type === 'whitelist/get') {
			getWhitelistedIds().then((ids) => sendResponse({ ids }));
			return true; // async response
		} else if (message?.type === 'whitelist/changed') {
			broadcastWhitelist();
		}
	});

	// Push the fresh whitelist to every YouTube tab so open feeds react live.
	async function broadcastWhitelist() {
		const ids = await getWhitelistedIds();
		const tabs = await browser.tabs.query({});
		for (const tab of tabs) {
			browser.tabs
				.sendMessage(tab.id, { type: 'whitelist/updated', ids })
				.catch(() => {});
		}
	}
});
