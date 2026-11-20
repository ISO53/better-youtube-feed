<template>
	<svg :viewBox="`0 0 ${W} ${H}`" class="chart" role="img" :aria-label="ariaLabel">
		<!-- horizontal grid + y labels -->
		<g v-for="tick in yTicks" :key="'y' + tick">
			<line class="grid" :x1="PAD_L" :x2="W - PAD_R" :y1="yFor(tick)" :y2="yFor(tick)" />
			<text class="tick" :x="PAD_L - 6" :y="yFor(tick) + 4" text-anchor="end">{{ tick }}</text>
		</g>

		<!-- x labels -->
		<text v-for="tick in xTicks" :key="'x' + tick.index" class="tick" :x="xFor(tick.index)"
			:y="H - PAD_B + 18" text-anchor="middle">{{ tick.text }}</text>

		<!-- series -->
		<g v-for="s in series" :key="s.key">
			<polyline class="line" :points="linePoints(s)" :stroke="s.color" />
			<g v-for="(p, i) in s.values" :key="i">
				<circle v-if="p != null" class="dot" :cx="xFor(i)" :cy="yFor(p)" r="3" :fill="s.color">
					<title>{{ s.label }} · {{ labels[i] }}: {{ p }}</title>
				</circle>
			</g>
		</g>
	</svg>
</template>

<script setup>
import { computed } from 'vue';

// Hand-rolled multi-series line chart; gaps in values render as breaks.
const props = defineProps({
	labels: { type: Array, required: true }, // per-x labels (dates)
	/** @type {{ key: string, label: string, color: string, values: (number|null)[] }[]} */
	series: { type: Array, required: true },
});

const W = 720;
const H = 240;
const PAD_L = 36;
const PAD_R = 12;
const PAD_T = 12;
const PAD_B = 24;

const ariaLabel = computed(() => `Chart: ${props.series.map((s) => s.label).join(', ')}`);

// Nice round max: 1/2/5 * 10^k just above the data.
const yMax = computed(() => {
	const max = Math.max(1, ...props.series.flatMap((s) => s.values.filter((v) => v != null)));
	const step = 10 ** Math.floor(Math.log10(max));
	for (const mult of [1, 2, 5, 10]) {
		if (mult * step >= max) return mult * step;
	}
	return max;
});

const yTicks = computed(() => {
	const ticks = [];
	for (let i = 0; i <= 4; i++) ticks.push(Math.round((yMax.value * i) / 4));
	return ticks;
});

// ~6 x labels spread across the range.
const xTicks = computed(() => {
	const n = props.labels.length;
	if (n === 0) return [];
	const every = Math.max(1, Math.ceil(n / 6));
	const ticks = [];
	for (let i = n - 1; i >= 0; i -= every) {
		ticks.unshift({ index: i, text: props.labels[i].slice(5) }); // MM-DD
	}
	return ticks;
});

function xFor(i) {
	const n = Math.max(1, props.labels.length - 1);
	return PAD_L + ((W - PAD_L - PAD_R) * i) / n;
}

function yFor(v) {
	return H - PAD_B - ((H - PAD_T - PAD_B) * v) / yMax.value;
}

function linePoints(s) {
	return s.values
		.map((v, i) => (v == null ? null : `${xFor(i)},${yFor(v)}`))
		.filter(Boolean)
		.join(' ');
}
</script>

<style scoped>
.chart {
	display: block;
	width: 100%;
	height: auto;
}

.grid {
	stroke: var(--byf-border);
	stroke-width: 1;
}

.tick {
	font-size: 10px;
	fill: var(--byf-text-dim);
}

.line {
	fill: none;
	stroke-width: 2;
	stroke-linejoin: round;
	stroke-linecap: round;
}

.dot {
	stroke: var(--byf-surface);
	stroke-width: 1;
}
</style>
