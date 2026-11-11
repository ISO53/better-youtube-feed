import { browser } from 'wxt/browser';

import { upsertVideos } from '../lib/db.js';

export default defineBackground(() => {
	// Single writer: merges batches coming from the content script into IDB.
	browser.runtime.onMessage.addListener((message) => {
		if (message?.type === 'videos/upsert') {
			upsertVideos(message.videos).catch((err) => console.error('[byf] upsert failed:', err));
		}
	});
});
