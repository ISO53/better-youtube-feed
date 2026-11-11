<template>
	<main class="popup">
		<h1 class="title">Better Youtube Feed</h1>
		<p class="status">Collector running.</p>
	</main>
</template>

<script setup>
// Popup root. Feature summary and quick toggles will live here.
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
	margin: 4px 0 0;
	font-size: 12px;
	color: var(--byf-text-dim);
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
