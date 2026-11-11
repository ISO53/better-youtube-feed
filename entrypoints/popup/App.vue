<template>
	<main class="popup">
		<h1 class="title">Better Youtube Feed</h1>
		<p class="status">{{ statusLine }}</p>
		<button class="open-settings" type="button" @click="openSettings">
			<Settings :size="18" />
			<span>Open settings</span>
		</button>
	</main>
</template>

<script setup>
import { Settings } from 'lucide-vue-next';
import { computed } from 'vue';
import { browser } from 'wxt/browser';

// Popup root: quick summary (grows per feature) + link to the full page.
const statusLine = computed(() => 'Hiding watched videos.');

// Open as an explicit full tab; independent of options_ui.open_in_tab state.
function openSettings() {
	browser.tabs.create({ url: browser.runtime.getURL('/options.html') });
}
</script>

<style scoped>
.popup {
	min-width: 300px;
	padding: 12px 16px;
	font-family: Roboto, 'YouTube Sans', system-ui, sans-serif;
	color: var(--byf-text);
	background: var(--byf-surface);
	margin: 0;
}

.title {
	margin: 0;
	font-size: 15px;
	font-weight: 500;
}

.status {
	margin: 4px 0 12px;
	font-size: 12px;
	color: var(--byf-text-dim);
}

.open-settings {
	display: flex;
	align-items: center;
	gap: 8px;
	padding: 6px 14px;
	font: 500 13px Roboto, 'YouTube Sans', system-ui, sans-serif;
	color: var(--byf-surface);
	background: var(--byf-text);
	border: none;
	border-radius: 18px;
	cursor: pointer;
}

.open-settings .icon {
	color: var(--byf-surface);
}
</style>

<style>
:root {
	--byf-text: #0f0f0f;
	--byf-text-dim: #606060;
	--byf-surface: #ffffff;
}

@media (prefers-color-scheme: dark) {
	:root {
		--byf-text: #f1f1f1;
		--byf-text-dim: #aaa;
		--byf-surface: #0f0f0f;
	}
}
</style>
