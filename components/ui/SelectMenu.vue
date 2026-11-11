<template>
	<div ref="root" class="select">
		<button class="trigger" type="button" :aria-expanded="String(open)" @click="open = !open">
			<span class="value">{{ selectedLabel }}</span>
			<ChevronDown class="chevron" :size="20" />
		</button>

		<ul v-if="open" class="menu" role="listbox">
			<li v-for="option in options" :key="option.value">
				<button :class="['option', { selected: option.value === modelValue }]" type="button" role="option"
					:aria-selected="String(option.value === modelValue)" @click="pick(option.value)">
					<span class="option-label">{{ option.label }}</span>
					<Check v-if="option.value === modelValue" :size="18" class="icon" />
				</button>
			</li>
		</ul>
	</div>
</template>

<script setup>
import { Check, ChevronDown } from 'lucide-vue-next';
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';

const props = defineProps({
	modelValue: { type: [String, Number], required: true },
	options: { type: Array, required: true },
});

const emit = defineEmits(['update:modelValue']);

const open = ref(false);
const root = ref(null);

const selectedLabel = computed(
	() => props.options.find((o) => o.value === props.modelValue)?.label ?? '',
);

function pick(value) {
	emit('update:modelValue', value);
	open.value = false;
}

function onDocClick(event) {
	if (open.value && root.value && !root.value.contains(event.target)) open.value = false;
}

onMounted(() => document.addEventListener('click', onDocClick));
onBeforeUnmount(() => document.removeEventListener('click', onDocClick));
</script>

<style scoped>
.select {
	position: relative;
}

.trigger {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 12px;
	min-width: 120px;
	padding: 8px 12px;
	border: 1px solid var(--byf-text-dim);
	border-radius: 8px;
	background: transparent;
	color: var(--byf-text);
	font: 400 14px Roboto, 'YouTube Sans', system-ui, sans-serif;
	cursor: pointer;
}

.chevron {
	color: var(--byf-text-dim);
	transition: transform 150ms ease;
}

.menu {
	position: absolute;
	top: calc(100% + 6px);
	right: 0;
	z-index: 10;
	min-width: 100%;
	margin: 0;
	padding: 8px 0;
	list-style: none;
	background: var(--byf-raised);
	border-radius: 12px;
	box-shadow: 0 4px 24px rgba(0, 0, 0, 0.35);
	overflow: hidden;
}

.option {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 16px;
	width: 100%;
	padding: 8px 16px;
	border: none;
	background: transparent;
	color: var(--byf-text);
	font: 400 14px Roboto, 'YouTube Sans', system-ui, sans-serif;
	cursor: pointer;
	text-align: left;
	white-space: nowrap;
}

.option:hover {
	background: var(--byf-hover);
}

.option.selected {
	font-weight: 500;
}

.option.selected .icon {
	color: var(--byf-text);
}
</style>
