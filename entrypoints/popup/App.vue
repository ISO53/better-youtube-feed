<template>
	<main class="popup">
		<div class="head">
			<h1 class="title">Better Youtube Feed</h1>
			<AnimateIcon as-child animate-on-hover>
				<button class="icon-btn" type="button" aria-label="Open stats and settings" @click="openSettings">
					<Settings :size="18" />
				</button>
			</AnimateIcon>
		</div>

		<div class="hero">
			<span class="hero-value">{{ weekHidden.toLocaleString() }}</span>
			<span class="hero-label">repeats hidden this week</span>
		</div>

		<ul class="stat-list">
			<li v-for="item in legend" :key="item.label" class="stat-row">
				<span class="stat-dot" :style="{ background: item.color }"></span>
				<span class="stat-label">{{ item.label }}</span>
				<span class="stat-value">{{ item.value }}</span>
			</li>
		</ul>

		<p class="today">{{ todayLine }}</p>

		<div class="gauge-wrap">
			<DonutChart :rings="donutRings" :span="90" />
		</div>
	</main>
</template>

<script setup>
import { AnimateIcon } from '@animate-ui/vue/icons';
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue';
import { browser } from 'wxt/browser';

import Settings from '../../components/animate-ui/icons/Settings.vue';
import DonutChart from '../../components/ui/DonutChart.vue';
import { getDailyStats, getFeedbackSummary, getFeedSummary } from '../../lib/db.js';
import { buildDonutRings, buildLegendItems } from '../../lib/stat-visuals.js';

// Popup root: this week's impact at a glance + the feed composition gauge
// (same corner-quarter design as the stats page, lib/stat-visuals.js).
const stats = ref([]);
const feed = reactive({ total: 0, hidden: 0, hiddenWatched: 0, hiddenIgnored: 0, whitelisted: 0 });
const feedback = reactive({ sent: 0, resurfaced: 0, pending: 0, failed: 0 });
let pollTimer = null;

async function load() {
	stats.value = await getDailyStats(7);
	Object.assign(feedback, await getFeedbackSummary());
	Object.assign(feed, await getFeedSummary());
}

const statsByDay = computed(() => new Map(stats.value.map((s) => [s.day, s])));

// Last 7 days of hide events, missing days counted as zero.
const weekHidden = computed(() => {
	const cutoff = dayKey(-6);
	return stats.value.filter((s) => s.day >= cutoff).reduce((sum, s) => sum + (s.hidden ?? 0), 0);
});

const todayLine = computed(() => {
	const today = statsByDay.value.get(dayKey()) ?? {};
	const { hidden = 0, feedbackSent = 0 } = today;
	if (!hidden && !feedbackSent) return 'Nothing hidden today — feed is clean.';
	return `Today · ${hidden} hidden · ${feedbackSent} sent`;
});

const donutRings = computed(() => buildDonutRings(feed, feedback));
const legend = computed(() => buildLegendItems(feed, feedback));

// Open as an explicit full tab; independent of options_ui.open_in_tab state.
function openSettings() {
	browser.tabs.create({ url: browser.runtime.getURL('/options.html') });
}

function dayKey(offsetDays = 0) {
	const d = new Date();
	d.setUTCDate(d.getUTCDate() + offsetDays);
	return d.toISOString().slice(0, 10);
}

onMounted(() => {
	load();
	pollTimer = setInterval(load, 5000);
});
onUnmounted(() => clearInterval(pollTimer));
</script>

<style scoped>
/* overflow:hidden clips the corner gauge, same trick as the stats page. */
.popup {
	position: relative;
	overflow: hidden;
	min-width: 300px;
	padding: 12px 16px 112px;
	font-family: Roboto, 'YouTube Sans', system-ui, sans-serif;
	color: var(--byf-text);
	background: var(--byf-surface);
	margin: 0;
}

.head {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 12px;
	margin-bottom: 10px;
}

.title {
	margin: 0;
	font-size: 15px;
	font-weight: 500;
}

.icon-btn {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	width: 30px;
	height: 30px;
	padding: 0;
	border: none;
	border-radius: 50%;
	background: transparent;
	color: var(--byf-text-dim);
	cursor: pointer;
}

.icon-btn:hover {
	background: var(--byf-hover);
	color: var(--byf-text);
}

.hero {
	display: flex;
	flex-direction: column;
	gap: 2px;
	margin-bottom: 14px;
}

.hero-value {
	font-size: 28px;
	font-weight: 500;
	line-height: 1.1;
}

.hero-label {
	font-size: 12px;
	color: var(--byf-text-dim);
}

.stat-list {
	display: flex;
	flex-direction: column;
	gap: 9px;
	list-style: none;
	margin: 0;
	padding: 0;
}

.stat-row {
	display: flex;
	align-items: center;
	gap: 8px;
	font-size: 12px;
}

.stat-dot {
	width: 8px;
	height: 8px;
	border-radius: 50%;
	flex-shrink: 0;
}

.stat-label {
	flex: 1;
	color: var(--byf-text);
}

.stat-value {
	color: var(--byf-text-dim);
}

.today {
	position: absolute;
	left: 16px;
	bottom: 14px;
	margin: 0;
	font-size: 12px;
	color: var(--byf-text-dim);
}

/* Quarter gauge pinned to the popup's bottom-right corner; the wrapper's
   center sits on the corner and overflow:hidden clips the rest. */
.gauge-wrap {
	position: absolute;
	right: 0;
	bottom: 0;
	width: 220px;
	height: 220px;
	transform: translate(50%, 50%);
}
</style>

<style>
:root {
	--byf-text: #0f0f0f;
	--byf-text-dim: #606060;
	--byf-surface: #ffffff;
	--byf-hover: #f2f2f2;
	--byf-chart-1: #065fd4;
	--byf-chart-2: #c9a227;
	--byf-chart-3: #d64a33;
	--byf-chart-4: #7c5cf0;
}

@media (prefers-color-scheme: dark) {
	:root {
		--byf-text: #f1f1f1;
		--byf-text-dim: #aaa;
		--byf-surface: #0f0f0f;
		--byf-hover: #272727;
		--byf-chart-1: #3ea6ff;
		--byf-chart-2: #e0b64a;
		--byf-chart-3: #ff7b5c;
		--byf-chart-4: #a78bfd;
	}
}
</style>
