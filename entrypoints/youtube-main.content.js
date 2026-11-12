// MAIN-world bridge: the only code that touches page context. Extracts
// feedback tokens from card Polymer data and executes feedback POSTs with
// the page's own innertube context. The ISOLATED side drives it via
// window.postMessage (see content/bridge.js).

const CARD_CONTAINERS = [
	'ytd-rich-item-renderer',
	'ytd-video-renderer',
	'ytd-compact-video-renderer',
	'ytd-grid-video-renderer',
	'ytd-playlist-video-renderer',
	'yt-lockup-view-model',
].join(',');

// Outer grid wrappers; the lockup's own .data is an empty object, the real
// payload lives on the wrapper (same normalization as content/extract.js).
const OUTER_CONTAINERS = [
	'ytd-rich-item-renderer',
	'ytd-video-renderer',
	'ytd-compact-video-renderer',
	'ytd-grid-video-renderer',
	'ytd-playlist-video-renderer',
].join(',');

export default defineContentScript({
	matches: ['https://www.youtube.com/*'],
	world: 'MAIN',
	runAt: 'document_idle',
	main() {
		window.addEventListener('message', (event) => {
			if (event.source !== window) return;
			const msg = event.data;
			if (msg?.source !== 'byf-isolated') return; // only our ISOLATED side
			if (msg?.type === 'byf-tokens-request') {
				respond(msg.id, extractTokens(msg.videoId));
			} else if (msg?.type === 'byf-send-request') {
				sendNotInterested(msg.tokens, msg.withReason)
					.then((result) => respond(msg.id, result))
					.catch((err) => respond(msg.id, { ok: false, error: String(err) }));
			}
		});

		function respond(id, payload) {
			window.postMessage({ source: 'byf-main', id, payload }, window.location.origin);
		}
	},
});

/**
 * Find the card for a videoId and pull its feedback endpoints.
 * @returns {{ ni: string, undo: string|null }|null}
 */
function extractTokens(videoId) {
	const anchors = document.querySelectorAll('a[href*="/watch?v="]');
	for (const anchor of anchors) {
		const match = /[?&]v=([a-zA-Z0-9_-]{11})/.exec(anchor.getAttribute('href') || '');
		if (match?.[1] !== videoId) continue;
		const nearest = anchor.closest(CARD_CONTAINERS);
		if (!nearest) continue;
		const card = nearest.closest(OUTER_CONTAINERS) || nearest;
		const data =
			card.data ??
			card.querySelector('yt-lockup-view-model')?.data ??
			card.querySelector(':scope > #content')?.data;
		const endpoints = data ? collectFeedbackEndpoints(data) : [];
		// Menu order: "Not interested" comes before "Don't recommend channel".
		if (endpoints.length > 0) {
			return { ni: endpoints[0].token, undo: endpoints[0].undo ?? null };
		}
		return null;
	}
	return null;
}

// Depth-limited walk collecting every feedbackEndpoint, document order.
// Cap is generous: the token path through the sheet view-model is ~20 deep.
function collectFeedbackEndpoints(data) {
	const found = [];
	const seen = new Set();
	(function walk(node, depth) {
		if (!node || typeof node !== 'object' || depth > 40 || seen.has(node)) return;
		seen.add(node);
		if (node.feedbackEndpoint && typeof node.feedbackEndpoint.feedbackToken === 'string') {
			found.push({
				token: node.feedbackEndpoint.feedbackToken,
				undo: node.feedbackEndpoint.undoFeedbackEndpoint?.undoToken ?? null,
			});
		}
		for (const key of Object.keys(node)) walk(node[key], depth + 1);
	})(data, 0);
	return found;
}

/**
 * POST the Not-interested token; optionally follow up with the
 * "already watched" reason token from the response (two-step flow).
 * @returns {Promise<{ok: boolean, reasonSent?: boolean, error?: string}>}
 */
async function sendNotInterested(tokens, withReason) {
	const first = await postFeedback(tokens.ni, false);
	if (!first.isProcessed) {
		return { ok: false, error: first.error ?? `status ${first.status}` };
	}

	if (!withReason) return { ok: true };

	const reasonToken =
		first.json?.feedbackResponses?.[0]?.followUpDialog?.dismissalFollowUpRenderer?.reasons?.[0]
			?.dismissalReasonTextRenderer?.feedbackToken;
	if (!reasonToken) return { ok: true, reasonSent: false };

	const second = await postFeedback(reasonToken, true);
	if (!second.isProcessed) {
		return { ok: false, error: second.error ?? `reason step, status ${second.status}` };
	}
	return { ok: true, reasonSent: true };
}

/** @returns {Promise<{isProcessed: boolean, status: number, json: Object, error?: string}>} */
async function postFeedback(token, isReason) {
	try {
		const context = window.ytcfg?.get?.('INNERTUBE_CONTEXT');
		const res = await fetch('/youtubei/v1/feedback?prettyPrint=false', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				...(await buildAuthHeaders()),
			},
			body: JSON.stringify({
				context,
				feedbackTokens: [token],
				isFeedbackTokenUnencrypted: false,
				shouldMerge: isReason,
			}),
		});
		const json = await res.json();
		return {
			isProcessed: Boolean(json?.feedbackResponses?.[0]?.isProcessed),
			status: res.status,
			json,
		};
	} catch (err) {
		return { isProcessed: false, status: 0, json: {}, error: String(err) };
	}
}

// YouTube requires SAPISIDHASH authorization on logged-in feedback posts.
// Hash: sha1(`${ts} ${SAPISID} ${origin}`), header: `SAPISIDHASH ${ts}_${hash}`.
async function buildAuthHeaders() {
	const cookies = Object.fromEntries(
		document.cookie.split('; ').map((pair) => {
			const idx = pair.indexOf('=');
			return [pair.slice(0, idx), pair.slice(idx + 1)];
		}),
	);
	const sid = cookies.SAPISID ?? cookies['__Secure-3PAPISID'] ?? cookies['__Secure-1PAPISID'];
	if (!sid) return {}; // logged out; cookie-authenticated request only

	const ts = Math.floor(Date.now() / 1000);
	const origin = 'https://www.youtube.com';
	const digest = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(`${ts} ${sid} ${origin}`));
	const hash = [...new Uint8Array(digest)]
		.map((byte) => byte.toString(16).padStart(2, '0'))
		.join('');
	return {
		Authorization: `SAPISIDHASH ${ts}_${hash}`,
		'X-Goog-AuthUser': '0',
		'X-Origin': origin,
	};
}
