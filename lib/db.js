// Shared IndexedDB access at the extension origin (background + UI pages).
// DB "byf": videos (keyed by videoId), logs (ring buffer, auto id),
// stats (daily counters keyed by YYYY-MM-DD).

/** @typedef {Object} VideoRecord
 * @property {string} videoId - 11-char YouTube video id
 * @property {string} title - best-effort title ('' until known)
 * @property {string} channel - channel name ('' until known)
 * @property {boolean} watched - YouTube marked the card watched
 * @property {number|null} watchedPct - 0-100 watch progress when known
 * @property {boolean} hidden - card currently hidden by the extension
 * @property {string|null} hiddenReason - 'watched' (later: 'ignored', ...)
 * @property {boolean} whitelisted - user flag: never hide this video
 * @property {boolean} recorderWatched - watch recorder crossed the threshold
 * @property {number|null} watchedAt - epoch ms when the recorder marked it
 * @property {string} surface - last seen: home|subscriptions|search|watch|other
 * @property {number} firstSeen - epoch ms of first collection
 * @property {number} lastSeen - epoch ms of most recent on-screen appearance
 * @property {number} seenCount - total counted sightings
 * @property {Object<string, number>} exposureDays - sightings per UTC day, capped
 */

/** @typedef {Object} LogEntry
 * @property {number} id - auto-increment key
 * @property {number} ts - epoch ms
 * @property {string} type - collect|hide|unhide|settings|error
 * @property {string} message - short detail ("70% watched") or settings sentence
 * @property {string} [videoId] - set for video events
 * @property {string} [title] - video title for video events
 */

/** @typedef {Object} DailyStats
 * @property {string} day - YYYY-MM-DD (UTC)
 * @property {number} collected - videos seen for the first time
 * @property {number} hidden - cards hidden
 * @property {number} ignored - cards hidden because repeatedly ignored
 * @property {number} recorded - videos the recorder marked watched
 * @property {number} unhidden - cards un-hidden
 */

/** @typedef {Object} FeedbackRecord
 * @property {string} videoId - key; one feedback attempt per video
 * @property {string} type - 'ni_watched' | 'ni_ignored'
 * @property {string} title - video title at hide time
 * @property {string} status - 'pending' | 'sent' | 'failed'
 * @property {{ni: string, undo: string|null}} tokens - captured at hide time
 * @property {number} enqueuedAt - epoch ms
 * @property {number|null} sentAt - epoch ms when the send completed
 */

import { openDB } from 'idb';

const DB_NAME = 'byf';
const DB_VERSION = 3;
const VIDEO_STORE = 'videos';
const LOG_STORE = 'logs';
const STATS_STORE = 'stats';
const FEEDBACK_STORE = 'feedback';
const MAX_LOG_ENTRIES = 500;
// Longest offered exposure window; older per-day buckets are pruned.
const MAX_EXPOSURE_DAYS = 60;

/** UTC day key, e.g. dayKey(-13) for the start of a 14-day window. */
function dayKey(offsetDays = 0) {
	const d = new Date();
	d.setUTCDate(d.getUTCDate() + offsetDays);
	return d.toISOString().slice(0, 10);
}

let dbPromise = null;

function getDb() {
	if (!dbPromise) {
		dbPromise = openDB(DB_NAME, DB_VERSION, {
			upgrade(db) {
				if (!db.objectStoreNames.contains(VIDEO_STORE)) {
					db.createObjectStore(VIDEO_STORE, { keyPath: 'videoId' });
				}
				if (!db.objectStoreNames.contains(LOG_STORE)) {
					db.createObjectStore(LOG_STORE, { keyPath: 'id', autoIncrement: true });
				}
				if (!db.objectStoreNames.contains(STATS_STORE)) {
					db.createObjectStore(STATS_STORE, { keyPath: 'day' });
				}
				if (!db.objectStoreNames.contains(FEEDBACK_STORE)) {
					db.createObjectStore(FEEDBACK_STORE, { keyPath: 'videoId' });
				}
			},
		});
	}
	return dbPromise;
}

/**
 * Merge incoming records into the store.
 * Each record may carry `seenCountDelta` (unsent on-screen hits from the
 * content script session); it is added to the persisted `seenCount`.
 * All other fields: incoming wins; `firstSeen` keeps the earliest;
 * `lastSeen` keeps the latest; `watchedPct` keeps the highest.
 * @param {VideoRecord[]} records - may carry an extra seenCountDelta field
 * @returns {Promise<Array<{videoId: string, title: string, watchedPct: number|null, isNew: boolean, hiddenBefore: boolean, hiddenAfter: boolean}>>}
 */
export async function upsertVideos(records) {
	if (!records?.length) return [];
	const db = await getDb();
	const tx = db.transaction(VIDEO_STORE, 'readwrite');
	const results = await Promise.all(
		records.map(async (rec) => {
			const existing = await tx.store.get(rec.videoId);
			const merged = {
				...existing,
				...rec,
				firstSeen: existing ? existing.firstSeen : rec.firstSeen,
				lastSeen: Math.max(existing?.lastSeen ?? 0, rec.lastSeen),
				seenCount: (existing?.seenCount ?? 0) + (rec.seenCountDelta ?? 0),
				watchedPct:
					rec.watchedPct == null
						? existing?.watchedPct ?? null
						: Math.max(rec.watchedPct, existing?.watchedPct ?? 0),
			};
			delete merged.seenCountDelta;
			// Sighting deltas also land in today's per-day exposure bucket.
			merged.exposureDays = { ...(existing?.exposureDays ?? {}) };
			const delta = rec.seenCountDelta ?? 0;
			if (delta > 0) {
				const today = dayKey();
				merged.exposureDays[today] = (merged.exposureDays[today] ?? 0) + delta;
				const days = Object.keys(merged.exposureDays).sort();
				while (days.length > MAX_EXPOSURE_DAYS) delete merged.exposureDays[days.shift()];
			}
			// Whitelist is user-owned; content-script records never carry it.
			merged.whitelisted = rec.whitelisted ?? existing?.whitelisted ?? false;
			// Recorder marks are sticky: once watched, always watched.
			merged.recorderWatched = Boolean(existing?.recorderWatched || rec.recorderWatched);
			merged.watchedAt = existing?.watchedAt ?? rec.watchedAt ?? null;
			await tx.store.put(merged);
			return {
				videoId: merged.videoId,
				title: merged.title,
				watchedPct: merged.watchedPct,
				hiddenReason: merged.hiddenReason ?? null,
				isNew: !existing,
				hiddenBefore: Boolean(existing?.hidden),
				hiddenAfter: Boolean(merged.hidden),
			};
		}),
	);
	await tx.done;
	return results;
}

/** @param {LogEntry} entry - without id/ts; both are set here */
export async function appendLog(entry) {
	const db = await getDb();
	const tx = db.transaction(LOG_STORE, 'readwrite');
	await tx.store.put({ ...entry, ts: Date.now() });
	const keys = await tx.store.getAllKeys();
	const excess = keys.slice(0, Math.max(0, keys.length - MAX_LOG_ENTRIES));
	for (const key of excess) await tx.store.delete(key);
	await tx.done;
}

/** @returns {Promise<LogEntry[]>} oldest first */
export async function getLogs() {
	const db = await getDb();
	return db.getAll(LOG_STORE);
}

export async function clearLogs() {
	const db = await getDb();
	await db.clear(LOG_STORE);
}

/**
 * Increment today's (UTC) counters. Used for stats charts and summaries.
 * @param {Partial<DailyStats>} increments - fields to add
 */
export async function bumpDailyStats(increments) {
	const db = await getDb();
	const day = new Date().toISOString().slice(0, 10);
	const tx = db.transaction(STATS_STORE, 'readwrite');
	const existing = await tx.store.get(day);
	const updated = { day, ...existing };
	for (const [key, value] of Object.entries(increments)) {
		updated[key] = (updated[key] ?? 0) + value;
	}
	await tx.store.put(updated);
	await tx.done;
}

/** @param {number} days - how many recent days to fetch */
export async function getDailyStats(days) {
	const db = await getDb();
	const all = await db.getAll(STATS_STORE);
	return all.slice(-days);
}

/** @returns {Promise<VideoRecord[]>} currently hidden, most recent sighting first */
export async function getHiddenVideos() {
	const db = await getDb();
	return (await db.getAll(VIDEO_STORE))
		.filter((rec) => rec.hidden && !rec.whitelisted)
		.sort((a, b) => b.lastSeen - a.lastSeen);
}

/** @returns {Promise<VideoRecord[]>} whitelisted, most recent sighting first */
export async function getWhitelistedVideos() {
	const db = await getDb();
	return (await db.getAll(VIDEO_STORE))
		.filter((rec) => rec.whitelisted)
		.sort((a, b) => b.lastSeen - a.lastSeen);
}

/** @returns {Promise<string[]>} videoIds flagged as never-hide */
export async function getWhitelistedIds() {
	const db = await getDb();
	return (await db.getAll(VIDEO_STORE))
		.filter((rec) => rec.whitelisted)
		.map((rec) => rec.videoId);
}

/**
 * Set/clear the never-hide flag. Adding also clears the hidden state so the
 * review list updates immediately; the feed un-hides on its next scan.
 * @returns {Promise<VideoRecord|null>} the updated record
 */
export async function setWhitelisted(videoId, value) {
	const db = await getDb();
	const tx = db.transaction(VIDEO_STORE, 'readwrite');
	const existing = await tx.store.get(videoId);
	if (!existing) {
		await tx.done;
		return null;
	}
	existing.whitelisted = value;
	if (value) {
		existing.hidden = false;
		existing.hiddenReason = null;
	}
	await tx.store.put(existing);
	await tx.done;
	return existing;
}

/**
 * Mark a video watched by the recorder (threshold-crossed playback position).
 * Creates the record when the video was never collected from a feed.
 * @param {{videoId: string, pct: number, title?: string, channel?: string}} data
 * @returns {Promise<boolean>} true when this was the first recorder mark
 */
export async function markVideoWatched(data) {
	const db = await getDb();
	const tx = db.transaction(VIDEO_STORE, 'readwrite');
	const existing = await tx.store.get(data.videoId);
	const firstMark = !existing?.recorderWatched;
	if (!firstMark) {
		await tx.done;
		return false;
	}
	const now = Date.now();
	const merged = {
		...existing,
		videoId: data.videoId,
		title: existing?.title || data.title || '',
		channel: existing?.channel || data.channel || '',
		firstSeen: existing?.firstSeen ?? now,
		lastSeen: existing?.lastSeen ?? now,
		watchedPct: Math.max(data.pct, existing?.watchedPct ?? 0),
		recorderWatched: true,
		watchedAt: now,
	};
	await tx.store.put(merged);
	await tx.done;
	return true;
}

/** @returns {Promise<string[]>} videoIds the recorder marked as watched */
export async function getRecorderWatchedIds() {
	const db = await getDb();
	return (await db.getAll(VIDEO_STORE))
		.filter((rec) => rec.recorderWatched)
		.map((rec) => rec.videoId);
}

/**
 * Videos whose sightings within the sliding window reach the threshold.
 * Whitelisted videos are never ignored.
 * @param {number} threshold - sightings needed
 * @param {number} windowDays - window length in days
 * @returns {Promise<string[]>}
 */
export async function getIgnoredIds(threshold, windowDays) {
	if (threshold <= 0 || windowDays <= 0) return [];
	const cutoff = dayKey(-(windowDays - 1));
	const db = await getDb();
	const all = await db.getAll(VIDEO_STORE);
	const ignored = [];
	for (const rec of all) {
		if (rec.whitelisted) continue;
		let sightings = 0;
		for (const [day, count] of Object.entries(rec.exposureDays ?? {})) {
			if (day >= cutoff) sightings += count;
		}
		if (sightings >= threshold) ignored.push(rec.videoId);
	}
	return ignored;
}

/** Store name -> object store mapping shared by stats/clear helpers. */
const STORES = {
	videos: VIDEO_STORE,
	logs: LOG_STORE,
	stats: STATS_STORE,
	feedback: FEEDBACK_STORE,
};

/**
 * Queue a feedback send; one attempt per video (existing record wins).
 * @param {FeedbackRecord} record
 * @returns {Promise<boolean>} true when newly queued
 */
export async function enqueueFeedback(record) {
	const db = await getDb();
	const tx = db.transaction(FEEDBACK_STORE, 'readwrite');
	if (await tx.store.get(record.videoId)) {
		await tx.done;
		return false;
	}
	await tx.store.put({ status: 'pending', sentAt: null, ...record, enqueuedAt: Date.now() });
	await tx.done;
	return true;
}

/** @returns {Promise<FeedbackRecord[]>} queued-but-unsent records */
export async function getPendingFeedback() {
	const db = await getDb();
	return (await db.getAll(FEEDBACK_STORE)).filter((rec) => rec.status === 'pending');
}

/** @param {string} videoId @param {boolean} ok */
export async function completeFeedback(videoId, ok) {
	const db = await getDb();
	const tx = db.transaction(FEEDBACK_STORE, 'readwrite');
	const rec = await tx.store.get(videoId);
	if (rec) {
		rec.status = ok ? 'sent' : 'failed';
		rec.sentAt = Date.now();
		await tx.store.put(rec);
	}
	await tx.done;
}

/**
 * Record counts + estimated byte sizes per store (serialized with TextEncoder).
 * @returns {Promise<Object>} { videos: {count, bytes}, logs: ..., stats: ... }
 */
export async function getStoreStats() {
	const db = await getDb();
	const encoder = new TextEncoder();
	const out = {};
	for (const [name, store] of Object.entries(STORES)) {
		const all = await db.getAll(store);
		out[name] = {
			count: all.length,
			bytes: all.reduce((sum, rec) => sum + encoder.encode(JSON.stringify(rec)).length, 0),
		};
	}
	return out;
}

/** @param {'videos'|'logs'|'stats'} name */
export async function clearStore(name) {
	const store = STORES[name];
	if (!store) throw new Error(`unknown store: ${name}`);
	const db = await getDb();
	await db.clear(store);
}

export async function clearAllStores() {
	const db = await getDb();
	for (const store of Object.values(STORES)) await db.clear(store);
}
