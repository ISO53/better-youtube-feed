<template>
	<input class="slider" type="range" :min="min" :max="max" :step="step" :value="modelValue" :aria-label="label"
		:disabled="disabled" @input="$emit('update:modelValue', Number($event.target.value))" />
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
	modelValue: { type: Number, required: true },
	min: { type: Number, default: 0 },
	max: { type: Number, default: 100 },
	step: { type: Number, default: 1 },
	label: { type: String, default: '' },
	disabled: { type: Boolean, default: false },
});

defineEmits(['update:modelValue']);

const fillPct = computed(() =>
	((props.modelValue - props.min) / (props.max - props.min)) * 100,
);

const track = computed(
	() =>
		`linear-gradient(to right, var(--byf-text) 0%, var(--byf-text) ${fillPct.value}%, ` +
		`var(--byf-switch-track) ${fillPct.value}%, var(--byf-switch-track) 100%)`,
);
</script>

<style scoped>
.slider {
	-webkit-appearance: none;
	appearance: none;
	width: 160px;
	height: 4px;
	border-radius: 2px;
	background: v-bind(track);
	outline: none;
	cursor: pointer;
}

.slider::-webkit-slider-thumb {
	-webkit-appearance: none;
	appearance: none;
	width: 14px;
	height: 14px;
	border: none;
	border-radius: 50%;
	background: var(--byf-text);
}

.slider::-moz-range-thumb {
	width: 14px;
	height: 14px;
	border: none;
	border-radius: 50%;
	background: var(--byf-text);
}

.slider:disabled {
	opacity: 0.6;
	cursor: default;
}
</style>
