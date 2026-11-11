<template>
	<section class="group">
		<h2 v-if="title" class="title">{{ title }}</h2>
		<div class="rows">
			<slot />
		</div>
	</section>
</template>

<script setup>
defineProps({
	title: { type: String, default: '' },
});
</script>

<style scoped>
.group {
	display: flex;
	flex-direction: column;
	gap: 12px;
}

.title {
	margin: 0;
	font-size: 16px;
	font-weight: 500;
	color: var(--byf-text);
}

.rows {
	background: var(--byf-raised);
	border-radius: 12px;
	padding: 0 16px;
	overflow: hidden;
}

/* SettingsRow draws its own divider; last row drops it. */
.rows :deep(.row:not(:last-child)) {
	border-bottom: 1px solid var(--byf-border);
}
</style>
