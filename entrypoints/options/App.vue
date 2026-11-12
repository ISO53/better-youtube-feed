<template>
	<div class="app">
		<AppSidebar v-model="activePage" :items="PAGES" />
		<main class="content">
			<component :is="pageComponent" />
		</main>
	</div>
</template>

<script setup>
import { computed, ref } from 'vue';

import AppSidebar from '../../components/ui/AppSidebar.vue';
import HiddenPage from './pages/HiddenPage.vue';
import LogsPage from './pages/LogsPage.vue';
import SettingsPage from './pages/SettingsPage.vue';

// Page shell: YouTube-style sidebar (LinkedIn placement) + centered narrow
// content column. New pages: add a PAGES entry + component in PAGE_COMPONENTS.
const PAGES = [
	{ key: 'settings', icon: 'settings', label: 'Settings' },
	{ key: 'hidden', icon: 'hidden', label: 'Hidden videos' },
	{ key: 'logs', icon: 'logs', label: 'Logs' },
];

const PAGE_COMPONENTS = {
	settings: SettingsPage,
	hidden: HiddenPage,
	logs: LogsPage,
};

const activePage = ref('settings');

const pageComponent = computed(() => PAGE_COMPONENTS[activePage.value]);
</script>

<style scoped>
.app {
	display: flex;
	min-height: 100vh;
}

.content {
	flex: 1;
	max-width: 900px;
	margin: 0 auto;
	padding: 48px 24px 96px;
	box-sizing: border-box;
}
</style>

<style>
:root {
	--byf-text: #0f0f0f;
	--byf-text-dim: #606060;
	--byf-surface: #ffffff;
	--byf-raised: #f8f8f8;
	--byf-hover: #f2f2f2;
	--byf-border: #e5e5e5;
	--byf-link: #065fd4;
	--byf-switch-track: #c8c8c8;
	--byf-switch-knob: #fafafa;
	--byf-switch-track-on: #0f0f0f;
	--byf-switch-knob-on: #ffffff;
}

@media (prefers-color-scheme: dark) {
	:root {
		--byf-text: #f1f1f1;
		--byf-text-dim: #aaa;
		--byf-surface: #0f0f0f;
		--byf-raised: #1f1f1f;
		--byf-hover: #272727;
		--byf-border: #272727;
		--byf-link: #3ea6ff;
		--byf-switch-track: #545454;
		--byf-switch-knob: #cfcfcf;
		--byf-switch-track-on: #f1f1f1;
		--byf-switch-knob-on: #0f0f0f;
	}
}

html,
body {
	margin: 0;
	background: var(--byf-surface);
	color: var(--byf-text);
	font-family: Roboto, 'YouTube Sans', system-ui, sans-serif;
}

/* Center button labels; padding-only sizing sits off-baseline in Chromium. */
button {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	line-height: 1;
}
</style>
