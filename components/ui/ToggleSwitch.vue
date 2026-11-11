<template>
	<button :class="['switch', { on: modelValue }]" type="button" role="switch" :aria-checked="String(modelValue)"
		:aria-label="label" @click="$emit('update:modelValue', !modelValue)">
		<span class="knob" />
	</button>
</template>

<script setup>
defineProps({
	modelValue: { type: Boolean, required: true },
	label: { type: String, default: '' },
});

defineEmits(['update:modelValue']);
</script>

<style scoped>
.switch {
	position: relative;
	width: 40px;
	height: 24px;
	flex-shrink: 0;
	border: none;
	border-radius: 12px;
	background: var(--byf-switch-track);
	cursor: pointer;
	transition: background 150ms ease;
}

.knob {
	position: absolute;
	top: 2px;
	left: 2px;
	width: 20px;
	height: 20px;
	border-radius: 10px;
	background: var(--byf-switch-knob);
	box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
	transition: transform 150ms ease, background 150ms ease;
}

.switch.on {
	background: var(--byf-switch-track-on);
}

.switch.on .knob {
	transform: translateX(16px);
	background: var(--byf-switch-knob-on);
}
</style>
