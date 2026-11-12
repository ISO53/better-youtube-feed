import { browser } from 'wxt/browser';

import { upsertVideos } from '../lib/db.js';
import { recordVideoEvents } from '../lib/events.js';

export default defineBackground(() => {
	// Single writer: merges batches coming from the content script into IDB
	// and derives log entries + stat counters from the transitions.
	browser.runtime.onMessage.addListener((message) => {
		if (message?.type === 'videos/upsert') {
			upsertVideos(message.videos)
				.then(recordVideoEvents)
				.catch((err) => console.error('[byf] upsert failed:', err));
		}
	});
});
