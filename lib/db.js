// Shared IndexedDB access at the extension origin (background writes, UI reads).
// DB "byf" v1, store "videos" keyed by videoId.

/** @typedef {Object} VideoRecord
 * @property {string} videoId - 11-char YouTube video id
 * @property {string} title - best-effort title ('' until known)
 * @property {string} channel - channel name ('' until known)
 * @property {boolean} watched - YouTube marked the card watched
 * @property {number|null} watchedPct - 0-100 watch progress when known
 * @property {boolean} hidden - card currently hidden by the extension
 * @property {string|null} hiddenReason - 'watched' (later: 'ignored', ...)
 * @property {string} surface - last seen: home|subscriptions|search|watch|other
 * @property {number} firstSeen - epoch ms of first collection
 * @property {number} lastSeen - epoch ms of most recent on-screen appearance
 * @property {number} seenCount - total on-screen scan hits
 */

import { openDB } from 'idb';

const DB_NAME = 'byf';
const DB_VERSION = 1;
const VIDEO_STORE = 'videos';

let dbPromise = null;

function getDb() {
	if (!dbPromise) {
		dbPromise = openDB(DB_NAME, DB_VERSION, {
			upgrade(db) {
				if (!db.objectStoreNames.contains(VIDEO_STORE)) {
					db.createObjectStore(VIDEO_STORE, { keyPath: 'videoId' });
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
 */
export async function upsertVideos(records) {
	if (!records?.length) return;
	const db = await getDb();
	const tx = db.transaction(VIDEO_STORE, 'readwrite');
	await Promise.all(
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
			await tx.store.put(merged);
		}),
	);
	await tx.done;
}
