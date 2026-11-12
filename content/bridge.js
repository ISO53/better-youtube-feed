// ISOLATED-side bridge to the MAIN-world script (entrypoints/youtube-main.content.js).
// Request/response over window.postMessage with id correlation and timeouts.

const REQUEST_TIMEOUT_MS = 2000;
let nextId = 1;

const pending = new Map(); // id -> resolve

window.addEventListener('message', (event) => {
	if (event.source !== window) return;
	const msg = event.data;
	if (msg?.source !== 'byf-main' || !pending.has(msg.id)) return;
	pending.get(msg.id)(msg.payload);
	pending.delete(msg.id);
});

/**
 * @returns {Promise<{ni: string, undo: string|null}|null>} tokens, or null if unavailable
 */
export function requestTokens(videoId) {
	return request('byf-tokens-request', { videoId });
}

/**
 * @param {{ni: string, undo: string|null}} tokens
 * @param {boolean} withReason - send the "already watched" follow-up too
 * @returns {Promise<{ok: boolean, reasonSent?: boolean}|null>}
 */
export function sendNotInterested(tokens, withReason) {
	return request('byf-send-request', { tokens, withReason });
}

function request(type, payload) {
	return new Promise((resolve) => {
		const id = `byf-${nextId++}`;
		pending.set(id, resolve);
		setTimeout(() => {
			if (pending.delete(id)) resolve(null);
		}, REQUEST_TIMEOUT_MS);
		window.postMessage({ source: 'byf-isolated', id, type, ...payload }, window.location.origin);
	});
}
