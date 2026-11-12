<template>
	<nav class="sidebar">
		<header class="head">
			<img class="logo" src="/icon/icon.svg" alt="" width="26" height="26" />
			<span class="name">Better Youtube Feed</span>
		</header>

		<ul class="items">
			<li v-for="item in items" :key="item.key">
				<button :class="['item', { active: item.key === modelValue }]" type="button"
					@click="$emit('update:modelValue', item.key)">
					<component :is="ICONS[item.icon]" :size="24" />
					<span class="label">{{ item.label }}</span>
				</button>
			</li>
		</ul>
	</nav>
</template>

<script setup>
import { BarChart3, EyeOff, Logs, SlidersHorizontal } from 'lucide-vue-next';

const ICONS = {
	settings: SlidersHorizontal,
	logs: Logs,
	stats: BarChart3,
	hidden: EyeOff,
};

/** @param {{ key: string, icon: string, label: string }[]} items */
/** @param {string} modelValue - active item key */
defineProps({
	items: { type: Array, required: true },
	modelValue: { type: String, required: true },
});

defineEmits(['update:modelValue']);
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
</style>
