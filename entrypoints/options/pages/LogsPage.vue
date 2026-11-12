<template>
	<div class="logs-page">
		<div class="head">
			<h1 class="page-title">Logs</h1>
			<div class="actions">
				<SelectMenu v-model="filter" :options="FILTERS" label="Filter by type" />
				<button class="clear" type="button" @click="clearAll">Clear</button>
			</div>
		</div>

		<p class="hint">First sightings and hide/unhide changes only. Repeat views are counted for
			stats but not logged.</p>

		<DataTable :columns="COLUMNS" :rows="filtered" key-field="id" :empty-message="'No events yet — browse YouTube and come back.'">
			<template #cell-ts="{ row }">
				<span class="mono">{{ formatTime(row.ts) }}</span>
			</template>
			<template #cell-type="{ row }">
				<span :class="['badge', `badge-${row.type}`]">{{ row.type }}</span>
			</template>
			<template #cell-video="{ row }">
				<a v-if="row.videoId" class="video" :href="`https://www.youtube.com/watch?v=${row.videoId}`"
					:title="row.message" target="_blank" rel="noreferrer">{{ row.title || row.videoId }}</a>
				<span v-else class="plain">{{ row.message }}</span>
			</template>
		</DataTable>
	</div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue';

import DataTable from '../../../components/ui/DataTable.vue';
import SelectMenu from '../../../components/ui/SelectMenu.vue';
import { clearLogs, getLogs } from '../../../lib/db.js';

// Live event stream; polls while open. Numbers live on the stats page.
const logs = ref([]);
const filter = ref('all');
let pollTimer = null;

const FILTERS = [
	{ value: 'all', label: 'All events' },
	{ value: 'collect', label: 'Collected' },
	{ value: 'hide', label: 'Hidden' },
	{ value: 'unhide', label: 'Unhidden' },
	{ value: 'whitelist', label: 'Whitelist' },
	{ value: 'watch', label: 'Watched' },
	{ value: 'settings', label: 'Settings' },
	{ value: 'error', label: 'Errors' },
];

const COLUMNS = [
	{ key: 'ts', label: 'Time', width: '90px' },
	{ key: 'type', label: 'Type', width: '90px' },
	{ key: 'video', label: 'Video' },
];

const filtered = computed(() =>
	filter.value === 'all' ? logs.value : logs.value.filter((l) => l.type === filter.value),
);

async function load() {
	logs.value = (await getLogs()).reverse();
}

async function clearAll() {
	await clearLogs();
	await load();
}

function formatTime(ts) {
	return new Date(ts).toLocaleTimeString();
}

onMounted(() => {
	load();
	pollTimer = setInterval(load, 3000);
});
onUnmounted(() => clearInterval(pollTimer));
</script>

<style scoped>
.logs-page {
	display: flex;
	flex-direction: column;
	gap: 16px;
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
	margin: -8px 0 0;
	font-size: 12px;
	color: var(--byf-text-dim);
}

.actions {
	display: flex;
	align-items: center;
	gap: 8px;
}

.clear {
	height: 32px;
	padding: 0 16px;
	border: 1px solid var(--byf-text-dim);
	border-radius: 16px;
	background: transparent;
	color: var(--byf-text);
	font: 400 13px Roboto, 'YouTube Sans', system-ui, sans-serif;
	cursor: pointer;
}

.mono {
	font-family: Consolas, monospace;
	font-size: 12px;
	color: var(--byf-text-dim);
}

.badge {
	display: inline-block;
	padding: 2px 8px;
	border-radius: 9px;
	font-size: 11px;
	background: var(--byf-hover);
	color: var(--byf-text);
}

.badge-hide {
	color: #ff6b6b;
}

.badge-unhide {
	color: #6bcB77;
}

.badge-whitelist {
	color: var(--byf-link);
}

.badge-watch {
	color: #c9a227;
}

.video {
	color: var(--byf-link);
	text-decoration: none;
}

.video:hover {
	text-decoration: underline;
}

.plain {
	color: var(--byf-text-dim);
}
</style>
