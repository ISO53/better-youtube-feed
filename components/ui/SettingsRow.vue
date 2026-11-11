<template>
	<div class="row">
		<div class="text">
			<span class="label">{{ label }}</span>
			<span v-if="desc" class="desc">{{ desc }}</span>
		</div>
		<div class="control">
			<slot />
		</div>
	</div>
</template>

<script setup>
defineProps({
	label: { type: String, required: true },
	desc: { type: String, default: '' },
});
</script>

<style scoped>
.row {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 24px;
	min-height: 64px;
	padding: 14px 0;
}

.text {
	display: flex;
	flex-direction: column;
	gap: 4px;
}

.label {
	font-size: 14px;
	font-weight: 400;
	color: var(--byf-text);
}

.desc {
	font-size: 12px;
	color: var(--byf-text-dim);
}

.control {
	flex-shrink: 0;
}
</style>
