<template>
	<div class="stats-page">
		<div class="head">
			<h1 class="page-title">Stats</h1>
			<div class="ranges">
				<button v-for="r in RANGES" :key="r" :class="['chip', { active: r === rangeDays }]" type="button"
					@click="rangeDays = r">{{ r }}d</button>
			</div>
		</div>

		<div class="cards">
			<div v-for="card in cards" :key="card.label" class="card">
				<span class="card-label">{{ card.label }}</span>
				<span class="card-value">{{ card.total }}</span>
				<span class="card-sub">+{{ card.today }} today · +{{ card.week }} this week</span>
			</div>
		</div>

		<section class="chart-block">
			<div class="chart-head">
				<span class="chart-title">Daily activity</span>
			</div>
			<LineChart v-if="hasChartData" :labels="chartLabels" :series="chartSeries" />
			<p v-else class="empty">No activity yet — browse YouTube and come back.</p>
			<p class="hint">Both lines drifting down over weeks means YouTube is learning to stop
				recommending these videos.</p>
		</section>

		<SettingsGroup title="Feedback honor">
			<SettingsRow label="Honored" :desc="`YouTube stopped recommending ${honoredPct}% of the videos we sent feedback for`">
				<span class="honor-value">{{ honoredPct }}%</span>
			</SettingsRow>
			<SettingsRow label="Sent" desc="Not-interested signals accepted by YouTube">
				<span class="meta">{{ feedback.sent }}</span>
			</SettingsRow>
			<SettingsRow label="Resurfaced" desc="Videos YouTube kept recommending despite feedback">
				<span class="meta">{{ feedback.resurfaced }}</span>
			</SettingsRow>
		</SettingsGroup>
		<p v-if="feedback.sent < 10" class="hint">Collecting data — honor rate needs more sent feedback to be
			meaningful.</p>
	</div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue';

import LineChart from '../../../components/ui/LineChart.vue';
import SettingsGroup from '../../../components/ui/SettingsGroup.vue';
import SettingsRow from '../../../components/ui/SettingsRow.vue';
import { getDailyStats, getFeedbackSummary, getWhitelistedIds } from '../../../lib/db.js';

// The teaching-effect view: daily hidden + feedback lines over a chosen range.
const RANGES = [7, 30, 90];
const rangeDays = ref(30);

const stats = ref([]);
const feedback = reactive({ sent: 0, resurfaced: 0, pending: 0, failed: 0 });
const whitelisted = ref(0);
let pollTimer = null;

const SERIES = [
	{ key: 'hidden', label: 'Hidden', color: 'var(--byf-chart-1)' },
	{ key: 'feedbackSent', label: 'Feedback sent', color: 'var(--byf-chart-2)' },
];

async function load() {
	stats.value = await getDailyStats(3650); // all-time is tiny; slice locally
	Object.assign(feedback, await getFeedbackSummary());
	whitelisted.value = (await getWhitelistedIds()).length;
}

// Continuous date axis: missing days render as zero (store only writes on activity).
const chartLabels = computed(() => {
	const days = [];
	for (let i = rangeDays.value - 1; i >= 0; i--) days.push(dayKey(-i));
	return days;
});

const chartSeries = computed(() =>
	SERIES.map((s) => ({
		key: s.key,
		label: s.label,
		color: s.color,
		values: valuesFor(s.key),
	})),
);

function valuesFor(key) {
	const byDay = new Map(stats.value.map((s) => [s.day, s]));
	return chartLabels.value.map((day) => byDay.get(day)?.[key] ?? 0);
}

const hasChartData = computed(() => stats.value.length > 0);

const honoredPct = computed(() => {
	if (feedback.sent === 0) return 0;
	return Math.round(((feedback.sent - feedback.resurfaced) / feedback.sent) * 100);
});

const cards = computed(() => [
	card('Hidden', 'hidden'),
	card('Feedback sent', 'feedbackSent'),
	card('Collected', 'collected'),
	{ label: 'Whitelisted', total: whitelisted.value, today: '—', week: '—' },
]);

function card(label, key) {
	const inRange = (days) => {
		const cutoff = dayKey(-(days - 1));
		return stats.value.filter((s) => s.day >= cutoff).reduce((sum, s) => sum + (s[key] ?? 0), 0);
	};
	return { label, total: inRange(3650), today: inRange(1), week: inRange(7) };
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
.stats-page {
	display: flex;
	flex-direction: column;
	gap: 24px;
}

.head {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 16px;
}

.page-title {
	margin: 0;
	font-size: 24px;
	font-weight: 500;
	color: var(--byf-text);
}

.ranges {
	display: flex;
	align-items: center;
	gap: 6px;
}

.chip {
	display: inline-flex;
	align-items: center;
	gap: 6px;
	height: 28px;
	padding: 0 12px;
	border: 1px solid var(--byf-border);
	border-radius: 14px;
	background: transparent;
	color: var(--byf-text-dim);
	font: 400 12px Roboto, 'YouTube Sans', system-ui, sans-serif;
	cursor: pointer;
}

.chip.active {
	background: var(--byf-hover);
	color: var(--byf-text);
	border-color: var(--byf-text-dim);
}

.cards {
	display: grid;
	grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
	gap: 12px;
}

.card {
	display: flex;
	flex-direction: column;
	gap: 4px;
	padding: 14px 16px;
	background: var(--byf-raised);
	border-radius: 12px;
}

.card-label {
	font-size: 12px;
	color: var(--byf-text-dim);
}

.card-value {
	font-size: 24px;
	font-weight: 500;
	color: var(--byf-text);
}

.card-sub {
	font-size: 11px;
	color: var(--byf-text-dim);
}

.chart-block {
	display: flex;
	flex-direction: column;
	gap: 8px;
}

.chart-head {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 16px;
}

.chart-title {
	font-size: 16px;
	font-weight: 500;
	color: var(--byf-text);
}

.empty {
	margin: 0;
	padding: 32px;
	text-align: center;
	color: var(--byf-text-dim);
	background: var(--byf-raised);
	border-radius: 12px;
}

.hint {
	margin: 0;
	font-size: 12px;
	color: var(--byf-text-dim);
}

.honor-value {
	font-size: 20px;
	font-weight: 500;
	color: var(--byf-text);
}

.meta {
	font-size: 14px;
	color: var(--byf-text);
}
</style>
