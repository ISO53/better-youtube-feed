<template>
	<nav class="sidebar">
		<header class="head">
			<img class="logo" src="/icon/icon.svg" alt="" width="26" height="26" />
			<span class="name">Better Youtube Feed</span>
		</header>

		<ul class="items">
			<li v-for="item in items" :key="item.key">
				<AnimateIcon as-child animate-on-hover>
					<button :class="['item', { active: item.key === modelValue }]" type="button"
						@click="$emit('update:modelValue', item.key)">
						<component :is="ICONS[item.icon]" :size="24" />
						<span class="label">{{ item.label }}</span>
					</button>
				</AnimateIcon>
			</li>
		</ul>

		<footer class="foot">v{{ version }}</footer>
	</nav>
</template>

<script setup>
import { AnimateIcon } from '@animate-ui/vue/icons';
import { browser } from 'wxt/browser';
import ChartLine from '../animate-ui/icons/ChartLine.vue';
import Database from '../animate-ui/icons/Database.vue';
import EyeOff from '../animate-ui/icons/EyeOff.vue';
import Info from '../animate-ui/icons/Info.vue';
import Logs from '../animate-ui/icons/Logs.vue';
import SlidersHorizontal from '../animate-ui/icons/SlidersHorizontal.vue';

const ICONS = {
	settings: SlidersHorizontal,
	logs: Logs,
	stats: ChartLine,
	hidden: EyeOff,
	data: Database,
	about: Info,
};

/** @param {{ key: string, icon: string, label: string }[]} items */
/** @param {string} modelValue - active item key */
defineProps({
	items: { type: Array, required: true },
	modelValue: { type: String, required: true },
});

defineEmits(['update:modelValue']);

const version = browser.runtime.getManifest().version;
</script>

<style scoped>
.sidebar {
	position: sticky;
	top: 0;
	display: flex;
	flex-direction: column;
	width: 240px;
	height: 100vh;
	flex-shrink: 0;
	padding: 8px 12px;
	box-sizing: border-box;
	background: var(--byf-surface);
	overflow-y: auto;
}

.head {
	display: flex;
	align-items: center;
	gap: 12px;
	padding: 12px 12px 16px;
}

.logo {
	border-radius: 6px;
}

.name {
	font-size: 14px;
	font-weight: 500;
	color: var(--byf-text);
}

.items {
	list-style: none;
	margin: 0;
	padding: 0;
	display: flex;
	flex-direction: column;
	gap: 2px;
}

.item {
	display: flex;
	align-items: center;
	justify-content: flex-start;
	gap: 20px;
	width: 100%;
	height: 40px;
	padding: 0 12px;
	border: none;
	border-radius: 10px;
	background: transparent;
	color: var(--byf-text);
	font: 400 14px Roboto, 'YouTube Sans', system-ui, sans-serif;
	cursor: pointer;
}

.item:hover {
	background: var(--byf-hover);
}

.item.active {
	background: var(--byf-hover);
	font-weight: 500;
}

.label {
	white-space: nowrap;
}

.foot {
	margin-top: auto;
	padding: 16px 12px 4px;
	font-size: 11px;
	color: var(--byf-text-dim);
}
</style>
