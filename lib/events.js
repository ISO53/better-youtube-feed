// Event semantics: turns storage transitions into log entries + stat counts.
// Every meaningful happening funnels through here so the log page and the
// stats charts can never disagree.

import { appendLog, bumpDailyStats } from './db.js';

/**
 * Derive events from an upsert batch (see upsertVideos return shape).
 * @param {Array<{videoId: string, title: string, watchedPct: number|null,
 *   isNew: boolean, hiddenBefore: boolean, hiddenAfter: boolean}>} results
 */
export async function recordVideoEvents(results) {
	for (const res of results) {
		if (res.isNew && res.hiddenAfter) {
			// Hidden on first sight: one entry, collect is implicit.
			await log('hide', pctText(res.watchedPct), res);
			await bumpDailyStats({ collected: 1, hidden: 1 });
		} else if (res.isNew) {
			await log('collect', 'First seen', res);
			await bumpDailyStats({ collected: 1 });
		} else if (!res.hiddenBefore && res.hiddenAfter) {
			await log('hide', pctText(res.watchedPct), res);
			await bumpDailyStats({ hidden: 1 });
		} else if (res.hiddenBefore && !res.hiddenAfter) {
			await log('unhide', pctText(res.watchedPct), res);
			await bumpDailyStats({ unhidden: 1 });
		}
	}
}

/**
 * @param {string} type
 * @param {string} message - short detail text
 * @param {{videoId: string, title: string}} [video] - attaches video context
 */
export async function log(type, message, video) {
	const entry = { type, message };
	if (video) {
		entry.videoId = video.videoId;
		entry.title = video.title;
	}
	await appendLog(entry).catch((err) =>
		console.error('[byf] log write failed:', err),
	);
}

/** Log a settings change; the caller phrases the message. */
export async function recordSettingsChange(message) {
	await log('settings', message);
}

/** Whitelist add/remove from the review page. @param {boolean} added */
export async function recordWhitelist(video, added) {
	await log('whitelist', added ? 'Never hide this video' : 'Allowed to hide again', video);
}

function pctText(pct) {
	return pct == null ? '?' : `${Math.round(pct)}%`;
}
