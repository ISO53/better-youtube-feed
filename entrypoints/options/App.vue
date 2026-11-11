<template>
	<main class="options">
		<h1 class="title">Better Youtube Feed</h1>
		<p class="status">Project scaffold — settings, logs and stats will live here.</p>
	</main>
</template>

<script setup>
// Options root. Extensive settings, log table, hidden-videos review and
// stats will live here.
</script>

<style scoped>
.options {
	max-width: 900px;
	margin: 0 auto;
	padding: 24px;
	font-family: Roboto, 'YouTube Sans', system-ui, sans-serif;
	color: var(--byf-text);
	background: var(--byf-surface);
	min-height: 100vh;
}

.title {
	margin: 0;
	font-size: 20px;
	font-weight: 500;
}

.status {
	margin: 8px 0 0;
	font-size: 13px;
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
