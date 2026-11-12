import { startFeedWatcher } from '../content/pipeline.js';
import { startRecorder } from '../content/recorder.js';

export default defineContentScript({
	matches: ['https://www.youtube.com/*'],
	runAt: 'document_idle',
	main(ctx) {
		startFeedWatcher(ctx);
		startRecorder(ctx);
	},
});
