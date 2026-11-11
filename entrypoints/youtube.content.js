import { startFeedWatcher } from '../content/pipeline.js';

export default defineContentScript({
	matches: ['https://www.youtube.com/*'],
	runAt: 'document_idle',
	main(ctx) {
		startFeedWatcher(ctx);
	},
});
