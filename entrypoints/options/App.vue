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
import SettingsPage from './pages/SettingsPage.vue';

// Page shell: YouTube-style sidebar (LinkedIn placement) + centered narrow
// content column. New pages: add a PAGES entry + component in PAGE_COMPONENTS.
const PAGES = [{ key: 'settings', icon: 'settings', label: 'Settings' }];

const PAGE_COMPONENTS = {
	settings: SettingsPage,
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
	max-width: 720px;
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
</style>
