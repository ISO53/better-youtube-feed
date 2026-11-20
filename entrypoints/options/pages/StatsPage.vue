<template>
	<div class="stats-page">
		<div class="head">
			<h1 class="page-title">Stats</h1>
			<div class="ranges">
				<button v-for="r in RANGES" :key="r" :class="['chip', { active: r === rangeDays }]" type="button"
					@click="rangeDays = r">{{ r }}d</button>
			</div>
		</div>

		<section class="hero">
			<div class="impact">
				<div class="impact-content">
					<div class="impact-head">
						<span class="hero-label">Your feed is getting better!</span>
						<span class="hero-pct">{{ feedPct }}% of your feed removed</span>
					</div>
					<ul class="legend-list">
						<li v-for="item in legend" :key="item.label" class="legend-item">
							<span class="legend-dot" :style="{ background: item.color }"></span>
							<span class="legend-text">
								<span class="legend-label">{{ item.label }}</span>
								<span class="legend-value">{{ item.value }}</span>
							</span>
						</li>
					</ul>
				</div>
				<div class="donut-wrap">
					<DonutChart :rings="donutRings" :span="90" />
				</div>
			</div>
			<aside class="honor-card">
				<div class="honor-head">
					<span class="honor-title">
						<span class="card-label">Honor Rate</span>
						<span class="honor-info">
							<svg :width="14" :height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
								stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
								<circle cx="12" cy="12" r="10" />
								<path d="M12 16v-4" />
								<path d="M12 8h.01" />
							</svg>
							<span class="honor-tooltip">How many of the videos we told YouTube to stop
								suggesting never reappeared in your feed. The higher, the better.</span>
						</span>
					</span>
					<span class="honor-pill">{{ honorSub }}</span>
				</div>
				<span class="honor-value">{{ honoredPct }}%</span>
			</aside>
		</section>

		<section class="chart-block">
			<div class="chart-head">
				<span class="chart-title">Daily activity</span>
			</div>
			<LineChart v-if="hasChartData" :labels="chartLabels" :series="chartSeries" />
			<p v-else class="empty">No activity yet, browse YouTube and come back.</p>
			<p class="hint">Both lines drifting down over weeks means YouTube is learning to stop
				recommending these videos.</p>
		</section>

		<section class="chart-block">
			<div class="chart-head">
				<span class="chart-title">Is YouTube learning?</span>
			</div>
			<LineChart v-if="learning" :labels="learning.labels" :series="learning.series" />
			<p v-else class="empty">Needs a bit more history. This appears after a week or two of
				browsing.</p>
			<p class="hint">Repeat exposure: How much of what you saw was repeats. Lower is better.
				Honor rate: How much of the sent feedback YouTube respects. Higher is better. A
				falling blue line with steady gold means YouTube is learning.</p>
			<p v-if="earlyDays" class="hint">The repeat line always climbs at first. Everything is
				new when the extension starts. Judge the trend after a few weeks of data.</p>
			<p v-if="feedback.sent < 10" class="hint">Collecting data. Honor rate needs more sent
				feedback to be meaningful.</p>
		</section>
	</div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue';

import DonutChart from '../../../components/ui/DonutChart.vue';
import LineChart from '../../../components/ui/LineChart.vue';
import { buildDonutRings, buildLegendItems } from '../../../lib/stat-visuals.js';
import {
	getDailyStats,
	getExposureByDay,
	getFeedbackSummary,
	getFeedSummary,
} from '../../../lib/db.js';

// The teaching-effect view: daily hidden + feedback lines over a chosen range.
const RANGES = [7, 30, 90];
const rangeDays = ref(30);

// The learning view: weekly repeat-exposure vs honor rate, fixed 8-week span
// (the exposure diaries only keep 60 days).
const LEARN_WEEKS = 8;
// Weeks with fewer sightings than this give a noisy % and are skipped.
const MIN_WEEK_SIGHTINGS = 10;

const stats = ref([]);
const feed = reactive({ total: 0, hidden: 0, hiddenWatched: 0, hiddenIgnored: 0, whitelisted: 0 });
const feedback = reactive({ sent: 0, resurfaced: 0, pending: 0, failed: 0 });
const exposure = ref([]); // {day, total, repeat} for days with sightings
let pollTimer = null;

const SERIES = [
	{ key: 'hidden', label: 'Hidden', color: 'var(--byf-chart-1)' },
	{ key: 'feedbackSent', label: 'Feedback sent', color: 'var(--byf-chart-2)' },
];

async function load() {
	stats.value = await getDailyStats(3650); // all-time is tiny; slice locally
	Object.assign(feedback, await getFeedbackSummary());
	Object.assign(feed, await getFeedSummary());
	exposure.value = await getExposureByDay(60);
}

const statsByDay = computed(() => new Map(stats.value.map((s) => [s.day, s])));

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
	return chartLabels.value.map((day) => statsByDay.value.get(day)?.[key] ?? 0);
}

const hasChartData = computed(() => stats.value.length > 0);

// The repeat line is meaningless until the catalog of known videos has
// filled up, so the early-climb caveat shows for the first ~4 weeks only.
const earlyDays = computed(() => {
	const first = stats.value[0]?.day;
	if (!first) return true;
	const spanDays = (Date.now() - new Date(first + 'T00:00:00Z').getTime()) / 86_400_000;
	return spanDays < 28;
});

// All-time honor from the feedback store (distinct videos).
const honoredPct = computed(() => {
	if (feedback.sent === 0) return 0;
	return Math.max(0, Math.round(((feedback.sent - feedback.resurfaced) / feedback.sent) * 100));
});

// Hero sparkline removed in favor of the composition donut below.
const feedPct = computed(() =>
	feed.total === 0 ? 0 : Math.round((feed.hidden / feed.total) * 100),
);

// Ring/legend composition shared with the popup (lib/stat-visuals.js).
const donutRings = computed(() => buildDonutRings(feed, feedback));
const legend = computed(() => buildLegendItems(feed, feedback));

const honorSub = computed(() =>
	weeklyHonorLatest.value == null ? 'This week —' : `This week ${weeklyHonorLatest.value}%`,
);

// --- Weekly learning view -------------------------------------------------

// Monday-start UTC week containing the given day key.
function weekStart(day) {
	const d = new Date(day + 'T00:00:00Z');
	d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
	return d.toISOString().slice(0, 10);
}

function addDays(day, n) {
	const d = new Date(day + 'T00:00:00Z');
	d.setUTCDate(d.getUTCDate() + n);
	return d.toISOString().slice(0, 10);
}

const weeks = computed(() => {
	const monday = weekStart(dayKey());
	const list = [];
	for (let i = LEARN_WEEKS - 1; i >= 0; i--) list.push(addDays(monday, -7 * i));
	return list;
});

// Share of feedback YouTube stopped re-serving: 1 - resurfaces this week /
// all feedback sent through the week's end. Events, clamped, null before any send.
function honorForWeek(startDay) {
	const endDay = addDays(startDay, 6);
	let sentThrough = 0;
	let resurfaced = 0;
	for (const s of stats.value) {
		if (s.day <= endDay) sentThrough += s.feedbackSent ?? 0;
		if (s.day >= startDay && s.day <= endDay) resurfaced += s.resurfaced ?? 0;
	}
	if (sentThrough === 0) return null;
	return Math.max(0, Math.round((1 - resurfaced / sentThrough) * 100));
}

// Share of the week's sightings that were previously-served videos.
function repeatForWeek(startDay) {
	const endDay = addDays(startDay, 6);
	let total = 0;
	let repeat = 0;
	for (const e of exposure.value) {
		if (e.day >= startDay && e.day <= endDay) {
			total += e.total;
			repeat += e.repeat;
		}
	}
	if (total < MIN_WEEK_SIGHTINGS) return null;
	return Math.round((repeat / total) * 100);
}

// Only weeks with both signals drawn, so the two lines share a clean axis.
const learning = computed(() => {
	const labels = [];
	const repeatValues = [];
	const honorValues = [];
	for (const startDay of weeks.value) {
		const repeat = repeatForWeek(startDay);
		const honor = honorForWeek(startDay);
		if (repeat == null || honor == null) continue;
		labels.push(startDay);
		repeatValues.push(repeat);
		honorValues.push(honor);
	}
	if (labels.length < 2) return null;
	return {
		labels,
		series: [
			{ key: 'repeat', label: 'Repeat exposure', color: 'var(--byf-chart-1)', values: repeatValues },
			{ key: 'honor', label: 'Honor rate', color: 'var(--byf-chart-2)', values: honorValues },
		],
	};
});

const weeklyHonorLatest = computed(() => {
	for (let i = weeks.value.length - 1; i >= 0; i--) {
		const honor = honorForWeek(weeks.value[i]);
		if (honor != null) return honor;
	}
	return null;
});

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

.hero {
	display: flex;
	align-items: stretch;
	gap: 12px;
	flex-wrap: wrap;
}

.impact {
	flex: 1;
	min-width: 420px;
	position: relative;
	overflow: hidden;
	display: flex;
	align-items: center;
	gap: 16px;
	padding: 20px;
	background: var(--byf-raised);
	border-radius: 12px;
}

.impact-content {
	flex: 1;
	min-width: 0;
	display: flex;
	flex-direction: column;
	align-items: flex-start;
	gap: 16px;
}

.impact-head {
	display: flex;
	align-items: center;
	gap: 10px;
	flex-wrap: wrap;
}

.hero-label {
	font-size: 18px;
	font-weight: 500;
	letter-spacing: 0.4px;
	color: var(--byf-text-dim);
}

.hero-pct {
	padding: 4px 10px;
	background: var(--byf-hover);
	border-radius: 14px;
	font-size: 14px;
	font-weight: 500;
	color: var(--byf-text);
}

/* Quarter gauge pinned to the bottom-right corner: the SVG's center sits on
   the card corner (translate 50%) and overflow:hidden clips everything but
   the top-left quadrant of the rings. */
.donut-wrap {
	position: absolute;
	right: 0;
	bottom: 0;
	width: 320px;
	height: 320px;
	transform: translate(50%, 50%);
}

.legend-list {
	display: grid;
	grid-template-columns: repeat(2, minmax(150px, 1fr));
	gap: 14px 24px;
	list-style: none;
	margin: 0;
	padding: 0;
	width: 100%;
	max-width: 440px;
}

.legend-item {
	display: flex;
	align-items: center;
	gap: 10px;
}

.legend-dot {
	width: 10px;
	height: 10px;
	border-radius: 50%;
	flex-shrink: 0;
}

.legend-text {
	display: flex;
	flex-direction: column;
	gap: 1px;
}

.legend-label {
	font-size: 13px;
	color: var(--byf-text);
}

.legend-value {
	font-size: 12px;
	color: var(--byf-text-dim);
}

.honor-card {
	width: 210px;
	flex-shrink: 0;
	display: flex;
	flex-direction: column;
	padding: 20px;
	background: var(--byf-raised);
	border-radius: 12px;
}

.honor-head {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 8px;
}

/* Inverted pill so it reads as a badge in both color modes. */
.honor-pill {
	padding: 4px 10px;
	background: var(--byf-text);
	color: var(--byf-surface);
	border-radius: 12px;
	font-size: 12px;
	font-weight: 500;
	white-space: nowrap;
}

.honor-title {
	display: inline-flex;
	align-items: center;
	gap: 5px;
}

.honor-info {
	position: relative;
	display: inline-flex;
	color: var(--byf-text-dim);
	cursor: help;
}

.honor-info:hover {
	color: var(--byf-text);
}

/* Pure-CSS hover tooltip: opens under the info icon, no JS state.
   Always dark, independent of the color mode. */
.honor-tooltip {
	display: none;
	position: absolute;
	top: calc(100% + 8px);
	left: -8px;
	width: 180px;
	padding: 8px 10px;
	background: #0f0f0f;
	color: #f1f1f1;
	border: 1px solid #272727;
	border-radius: 8px;
	box-shadow: 0 4px 14px rgba(0, 0, 0, 0.35);
	font-size: 11px;
	line-height: 1.45;
	text-align: left;
	z-index: 10;
	pointer-events: none;
}

.honor-info:hover .honor-tooltip {
	display: block;
}

/* Big value pinned to the bottom-left of the card. */
.honor-value {
	margin-top: auto;
	font-size: 44px;
	font-weight: 600;
	line-height: 1;
	color: var(--byf-text);
}

.card-label {
	font-size: 12px;
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
</style>
