<template>
	<div class="hidden-page">
		<div class="head">
			<h1 class="page-title">Hidden videos</h1>
			<div class="actions">
				<SelectMenu v-model="view" :options="VIEWS" label="Choose view" />
			</div>
		</div>

		<p class="hint">Videos hidden because you already watched them. Flag a false positive and it
			never hides again.</p>

		<DataTable :columns="COLUMNS" :rows="shownRows" key-field="videoId"
			:empty-message="view === 'hidden' ? 'Nothing hidden yet — browse YouTube.' : 'No whitelisted videos.'">
			<template #cell-video="{ row }">
				<a class="video" :href="`https://www.youtube.com/watch?v=${row.videoId}`"
					:title="row.title" target="_blank" rel="noreferrer">{{ row.title || row.videoId }}</a>
			</template>
			<template #cell-channel="{ row }">
				<span class="dim">{{ row.channel || '—' }}</span>
			</template>
			<template #cell-reason="{ row }">
				<span class="dim">watched {{ pct(row) }}{{ row.recorderWatched ? ' (recorded)' : '' }}</span>
			</template>
			<template #cell-lastSeen="{ row }">
				<span class="dim">{{ formatDate(row.lastSeen) }}</span>
			</template>
			<template #cell-action="{ row }">
				<button :class="view === 'hidden' ? 'flag' : 'unflag'" type="button"
					@click="toggle(row)">{{ view === 'hidden' ? "Don't hide" : 'Hide again' }}</button>
			</template>
		</DataTable>
	</div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { browser } from 'wxt/browser';

import DataTable from '../../../components/ui/DataTable.vue';
import SelectMenu from '../../../components/ui/SelectMenu.vue';
import { getHiddenVideos, getWhitelistedVideos, setWhitelisted } from '../../../lib/db.js';
import { recordWhitelist } from '../../../lib/events.js';

// False-positive review: hidden list + whitelist management in one page.
const view = ref('hidden');
const hiddenRows = ref([]);
const whitelistedRows = ref([]);
let pollTimer = null;

const VIEWS = [
	{ value: 'hidden', label: 'Hidden' },
	{ value: 'whitelisted', label: 'Whitelisted' },
];

const COLUMNS = [
	{ key: 'video', label: 'Video' },
	{ key: 'channel', label: 'Channel', width: '140px' },
	{ key: 'reason', label: 'Reason', width: '110px' },
	{ key: 'lastSeen', label: 'Last seen', width: '110px' },
	{ key: 'action', label: '', width: '110px' },
];

const shownRows = computed(() =>
	view.value === 'hidden' ? hiddenRows.value : whitelistedRows.value,
);

async function load() {
	[hiddenRows.value, whitelistedRows.value] = await Promise.all([
		getHiddenVideos(),
		getWhitelistedVideos(),
	]);
}

async function toggle(row) {
	const added = view.value === 'hidden';
	await setWhitelisted(row.videoId, added);
	await recordWhitelist({ videoId: row.videoId, title: row.title }, added);
	// Background pushes the fresh whitelist to every open YouTube tab.
	browser.runtime.sendMessage({ type: 'state/changed' }).catch(() => {});
	await load();
}

function pct(row) {
	return row.watchedPct == null ? '?' : `${Math.round(row.watchedPct)}%`;
}

function formatDate(ts) {
	return ts ? new Date(ts).toLocaleDateString() : 'never seen';
}

onMounted(() => {
	load();
	pollTimer = setInterval(load, 3000);
});
onUnmounted(() => clearInterval(pollTimer));
</script>

<style scoped>
.hidden-page {
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

.video {
	color: var(--byf-link);
	text-decoration: none;
}

.video:hover {
	text-decoration: underline;
}

.dim {
	color: var(--byf-text-dim);
}

button {
	height: 32px;
	padding: 0 14px;
	border-radius: 16px;
	background: transparent;
	font: 500 13px Roboto, 'YouTube Sans', system-ui, sans-serif;
	cursor: pointer;
}

.flag {
	border: 1px solid var(--byf-text-dim);
	color: var(--byf-text);
}

.unflag {
	border: 1px solid #cc0000;
	color: #cc0000;
}
</style>
