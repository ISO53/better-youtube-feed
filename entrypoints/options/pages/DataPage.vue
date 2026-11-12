<template>
	<div class="data-page">
		<div class="head">
			<h1 class="page-title">Data</h1>
			<button class="refresh" type="button" @click="load">Refresh</button>
		</div>

		<p class="hint">Sizes are estimated from serialized records. Open YouTube tabs may re-collect
			videos after clearing.</p>

		<SettingsGroup title="Storage">
			<SettingsRow v-for="store in stores" :key="store.key" :label="store.label"
				:desc="store.desc">
				<div class="row-control">
					<span class="meta">{{ store.count }} · {{ formatBytes(store.bytes) }}</span>
					<button class="clear" type="button" @click="clear(store.key)">Clear</button>
				</div>
			</SettingsRow>

			<SettingsRow label="Settings" desc="Your preferences (threshold, toggles)">
				<div class="row-control">
					<span class="meta">{{ settingsCount }} · {{ formatBytes(settingsBytes) }}</span>
					<button class="clear" type="button" @click="resetSettings">Reset</button>
				</div>
			</SettingsRow>
		</SettingsGroup>

		<SettingsGroup title="Everything">
			<SettingsRow label="Clear all data" desc="Videos, logs, stats and settings">
				<button :class="['danger', { armed }]" type="button" @click="clearAll">
					{{ armed ? 'Click again to confirm' : 'Clear all' }}
				</button>
			</SettingsRow>
		</SettingsGroup>
	</div>
</template>

<script setup>
import { onMounted, onUnmounted, reactive, ref } from 'vue';
import { browser } from 'wxt/browser';

import SettingsGroup from '../../../components/ui/SettingsGroup.vue';
import SettingsRow from '../../../components/ui/SettingsRow.vue';
import { clearAllStores, clearStore, getStoreStats } from '../../../lib/db.js';
import { log } from '../../../lib/events.js';

// Storage overview: per-store counts/sizes with individual and global clears.
const stores = reactive([
	{ key: 'videos', label: 'Videos', desc: 'Collected video records', count: 0, bytes: 0 },
	{ key: 'logs', label: 'Logs', desc: 'Event history (capped at 500 entries)', count: 0, bytes: 0 },
	{ key: 'stats', label: 'Stats', desc: 'Daily counters for charts', count: 0, bytes: 0 },
	{ key: 'feedback', label: 'Feedback', desc: 'Not-interested send history', count: 0, bytes: 0 },
]);
const settingsCount = ref(0);
const settingsBytes = ref(0);
const armed = ref(false);
let pollTimer = null;
let armTimer = null;

async function load() {
	const stats = await getStoreStats();
	for (const store of stores) {
		store.count = stats[store.key].count;
		store.bytes = stats[store.key].bytes;
	}
	await loadSettingsStats();
}

async function loadSettingsStats() {
	const stored = (await browser.storage.local.get('settings')).settings ?? {};
	const keys = Object.keys(stored);
	settingsCount.value = keys.length;
	settingsBytes.value = new TextEncoder().encode(JSON.stringify(stored)).length;
}

async function clear(key) {
	await clearStore(key);
	if (key === 'videos') await log('settings', 'Videos data cleared');
	await load();
}

async function resetSettings() {
	await browser.storage.local.remove('settings');
	await load();
}

function clearAll() {
	if (!armed.value) {
		armed.value = true;
		armTimer = setTimeout(() => (armed.value = false), 3000);
		return;
	}
	clearTimeout(armTimer);
	armed.value = false;
	clearAllStores()
		.then(() => browser.storage.local.remove('settings'))
		.then(load)
		.catch((err) => console.error('[byf] clear all failed:', err));
}

function formatBytes(bytes) {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

onMounted(() => {
	load();
	pollTimer = setInterval(load, 3000);
});
onUnmounted(() => {
	clearInterval(pollTimer);
	clearTimeout(armTimer);
});
</script>

<style scoped>
.data-page {
	display: flex;
	flex-direction: column;
	gap: 24px;
}

.head {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 16px;
}

.page-title {
	margin: 0;
	font-size: 24px;
	font-weight: 500;
	color: var(--byf-text);
}

.hint {
	margin: -16px 0 0;
	font-size: 12px;
	color: var(--byf-text-dim);
}

.row-control {
	display: flex;
	align-items: center;
	gap: 12px;
}

.meta {
	font-size: 13px;
	color: var(--byf-text-dim);
	white-space: nowrap;
}

.refresh {
	height: 32px;
	padding: 0 16px;
	border: 1px solid var(--byf-text-dim);
	border-radius: 16px;
	background: transparent;
	color: var(--byf-text);
	font: 400 13px Roboto, 'YouTube Sans', system-ui, sans-serif;
	cursor: pointer;
}

.clear {
	height: 32px;
	padding: 0 14px;
	border: 1px solid var(--byf-text-dim);
	border-radius: 16px;
	background: transparent;
	color: var(--byf-text);
	font: 500 13px Roboto, 'YouTube Sans', system-ui, sans-serif;
	cursor: pointer;
}

.danger {
	height: 32px;
	padding: 0 14px;
	border: 1px solid #cc0000;
	border-radius: 16px;
	background: transparent;
	color: #cc0000;
	font: 500 13px Roboto, 'YouTube Sans', system-ui, sans-serif;
	cursor: pointer;
}

.danger.armed {
	background: #cc0000;
	color: #ffffff;
}
</style>
