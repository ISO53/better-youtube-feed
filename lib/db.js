// Shared IndexedDB access, used from the background script (writes coming from
// the content script) and the options page (reads). Runs at the extension
// origin in both cases.
//
// DB: "byf", version 1
// Store "videos" (keyPath: videoId)
//
// VideoRecord shape:
// {
//   videoId: string,         // 11-char YouTube video id
//   title: string,           // best-effort title text ('' until known)
//   channel: string,         // channel name ('' until known)
//   watched: boolean,        // YouTube marked the card watched (progress bar/overlay)
//   watchedPct: number|null, // 0-100 watch progress when known
//   surface: string,         // where last seen: home|subscriptions|search|watch|other
//   firstSeen: number,       // epoch ms, first collection ever
//   lastSeen: number,        // epoch ms, most recent on-screen appearance
//   seenCount: number        // total on-screen scan hits (persisted sum of deltas)
// }

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
 * @param {Array} records - VideoRecord[] with optional seenCountDelta
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
