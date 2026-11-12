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
			await log('hide', hideDetail(res), res);
			await bumpDailyStats(hiddenCounters(res));
		} else if (res.isNew) {
			await log('collect', 'First seen', res);
			await bumpDailyStats({ collected: 1 });
		} else if (!res.hiddenBefore && res.hiddenAfter) {
			await log('hide', hideDetail(res), res);
			await bumpDailyStats(hiddenCounters(res));
		} else if (res.hiddenBefore && !res.hiddenAfter) {
			await log('unhide', pctText(res.watchedPct), res);
			await bumpDailyStats({ unhidden: 1 });
		}
	}
}

/** Hide detail text keyed by the reason that caused it. */
function hideDetail(res) {
	return res.hiddenReason === 'ignored'
		? 'Seen repeatedly without opening'
		: pctText(res.watchedPct);
}

/** @returns {Object} stat counters for one hide event */
function hiddenCounters(res) {
	return res.hiddenReason === 'ignored'
		? { hidden: 1, ignored: 1 }
		: { hidden: 1 };
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

/** First recorder mark for a video (threshold-crossed playback). */
export async function recordWatched(video, pct) {
	await log('watch', `Reached ${Math.round(pct)}% of the video`, video);
	await bumpDailyStats({ recorded: 1 });
}

/** A feedback POST went through. @param {boolean} withReason */
export async function recordFeedbackSent(video, withReason) {
	const detail = withReason ? 'Not interested sent (already watched)' : 'Not interested sent';
	await log('feedback', detail, video);
	await bumpDailyStats({ feedbackSent: 1 });
}

/** A feedback POST failed. */
export async function recordFeedbackFailed(video) {
	await log('error', 'Feedback send failed', video);
}

function pctText(pct) {
	return pct == null ? '?' : `${Math.round(pct)}%`;
}
