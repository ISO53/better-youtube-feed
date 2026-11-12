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
 * @property {string} surface - last seen: home|subscriptions|search|watch|other
 * @property {number} firstSeen - epoch ms of first collection
 * @property {number} lastSeen - epoch ms of most recent on-screen appearance
 * @property {number} seenCount - total on-screen scan hits
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
 * @property {number} unhidden - cards un-hidden
 */

import { openDB } from 'idb';

const DB_NAME = 'byf';
const DB_VERSION = 2;
const VIDEO_STORE = 'videos';
const LOG_STORE = 'logs';
const STATS_STORE = 'stats';
const MAX_LOG_ENTRIES = 500;

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
			// Whitelist is user-owned; content-script records never carry it.
			merged.whitelisted = rec.whitelisted ?? existing?.whitelisted ?? false;
			await tx.store.put(merged);
			return {
				videoId: merged.videoId,
				title: merged.title,
				watchedPct: merged.watchedPct,
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
