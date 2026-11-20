<template>
	<div class="chart-wrap">
		<svg :viewBox="`0 0 ${W} ${H}`" class="chart" role="img" :aria-label="ariaLabel" @mousemove="onMove"
			@mouseleave="hover = null" @mousedown.prevent>
			<defs>
				<linearGradient v-for="s in series" :id="gradId(s.key)" :key="s.key" x1="0" y1="0" x2="0" y2="1">
					<stop offset="0%" :stop-color="s.color" stop-opacity="0.22" />
					<stop offset="100%" :stop-color="s.color" stop-opacity="0.02" />
				</linearGradient>
			</defs>

			<!-- horizontal grid + y labels -->
			<g v-for="tick in yTicks" :key="'y' + tick">
				<line class="grid" :x1="PAD_L" :x2="W - PAD_R" :y1="yFor(tick)" :y2="yFor(tick)" />
				<text class="tick" :x="PAD_L - 6" :y="yFor(tick) + 4" text-anchor="end">{{ tick }}</text>
			</g>

			<!-- x labels -->
			<text v-for="tick in xTicks" :key="'x' + tick.index" class="tick" :x="xFor(tick.index)"
				:y="H - PAD_B + 18" text-anchor="middle">{{ tick.text }}</text>

			<!-- series: shaded area under a monotone-smoothed line; paths are sampled
				at a fixed point count so switching ranges tweens instead of jumping -->
			<g v-for="s in series" :key="s.key">
				<motion.path class="area" :fill="`url(#${gradId(s.key)})`" :initial="areaState(s)"
					:animate="areaState(s)" :transition="MORPH" />
				<motion.path class="line" :stroke="s.color" :initial="lineState(s)" :animate="lineState(s)"
					:transition="MORPH" />
			</g>

			<!-- hover: guide + dots for the hovered day -->
			<g v-if="hover != null">
				<line class="guide" :x1="xFor(hover)" :x2="xFor(hover)" :y1="PAD_T" :y2="H - PAD_B" />
				<circle v-for="s in series" :key="s.key" class="dot" :cx="xFor(hover)" :cy="yFor(s.values[hover])"
					r="4" :fill="s.color" />
			</g>
		</svg>

		<!-- color indicators for the lines -->
		<div class="legend">
			<span v-for="s in series" :key="s.key" class="legend-item">
				<span class="legend-swatch" :style="{ background: s.color }"></span>{{ s.label }}
			</span>
		</div>

		<div v-if="hover != null" class="tooltip" :class="{ flip: tooltipFlip }" :style="{ left: tooltipLeft }">
			<span class="tooltip-date">{{ labels[hover] }}</span>
			<span v-for="s in series" :key="s.key" class="tooltip-row">
				<span class="tooltip-marker" :style="{ background: s.color }"></span>
				<span>{{ s.label }}: {{ s.values[hover] }}</span>
			</span>
		</div>
	</div>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { motion } from 'motion-v';

// Multi-series line chart with a hover readout. Lines are bump-smoothed —
// per-day cubic Bezier segments with horizontal handles, so the curve passes
// through every point, rounds every corner and never overshoots — and sampled
// at a fixed SAMPLES count so the path strings keep the same structure across
// ranges and motion-v can tween them on a range switch.
// Values must be gap-free (StatsPage zero-fills missing days).
const props = defineProps({
	labels: { type: Array, required: true }, // per-x labels (dates)
	/** @type {{ key: string, label: string, color: string, values: number[] }[]} */
	series: { type: Array, required: true },
});

const W = 720;
const H = 240;
const PAD_L = 36;
const PAD_R = 12;
const PAD_T = 12;
const PAD_B = 24;
const SAMPLES = 360; // fixed rendered-point count (~4/day at 90d), keeps path strings tweenable
const MORPH = { type: 'tween', duration: 0.6, ease: 'easeInOut' };

const ariaLabel = computed(() => `Chart: ${props.series.map((s) => s.label).join(', ')}`);

// Nice round max: 1/2/5 * 10^k just above the data.
const yMax = computed(() => {
	const max = Math.max(1, ...props.series.flatMap((s) => s.values));
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

// x in data-index units; fractions land between days on the smoothed curve.
function xFor(x) {
	const n = Math.max(1, props.labels.length - 1);
	return PAD_L + ((W - PAD_L - PAD_R) * x) / n;
}

function yFor(v) {
	return H - PAD_B - ((H - PAD_T - PAD_B) * v) / yMax.value;
}

const fmt = (v) => Math.round(v * 100) / 100;

// One smooth segment (data-index space, unit day spacing): cubic Bezier from
// (0, y0) to (1, y1) with both handles at the horizontal midpoint. The curve
// stays between y0 and y1, so peaks are exactly at their data points.
function segX(u) {
	return 1.5 * u - 1.5 * u * u + u * u * u;
}

function segY(u, y0, y1) {
	const w0 = (1 - u) ** 3 + 3 * (1 - u) ** 2 * u;
	const w1 = 3 * (1 - u) * u * u + u ** 3;
	return w0 * y0 + w1 * y1;
}

// Invert segX (monotone 0→1) so samples can target even x positions.
function segU(f) {
	let u = f;
	for (let i = 0; i < 4; i++) {
		u -= (segX(u) - f) / (1.5 - 3 * u + 3 * u * u);
	}
	return Math.min(Math.max(u, 0), 1);
}

function linePath(s) {
	const n = s.values.length;
	if (n < 2) return `M ${fmt(xFor(0))} ${fmt(yFor(s.values[0] ?? 0))}`;
	const ys = s.values;
	const parts = [];
	for (let k = 0; k < SAMPLES; k++) {
		const x = (k / (SAMPLES - 1)) * (n - 1);
		const i = Math.min(Math.floor(x), n - 2);
		const u = segU(x - i);
		parts.push(`${fmt(xFor(i + segX(u)))} ${fmt(yFor(segY(u, ys[i], ys[i + 1])))}`);
	}
	return `M ${parts[0]} L ${parts.slice(1).join(' L ')}`;
}

function areaPath(s) {
	const head = linePath(s);
	if (s.values.length < 2) return `${head} L ${fmt(xFor(0))} ${H - PAD_B} Z`;
	const n = s.values.length;
	return `${head} L ${fmt(xFor(n - 1))} ${H - PAD_B} L ${fmt(xFor(0))} ${H - PAD_B} Z`;
}

const lineState = (s) => ({ d: linePath(s) });
const areaState = (s) => ({ d: areaPath(s) });
const gradId = (key) => `byf-area-${key}`;

// Hover: nearest day wins; the tooltip follows in CSS pixels (svg scales).
const hover = ref(null);
const wrapW = ref(0);

function onMove(e) {
	// Ignore synthetic moves (Chrome fires them before clicks and after DOM
	// updates under a resting cursor) so only real pointer motion shows it.
	if (e.movementX === 0 && e.movementY === 0) return;
	const rect = e.currentTarget.getBoundingClientRect();
	wrapW.value = rect.width;
	const vx = ((e.clientX - rect.left) / rect.width) * W;
	const n = props.labels.length;
	const idx = Math.round(((vx - PAD_L) / (W - PAD_L - PAD_R)) * (n - 1));
	const inside = vx >= PAD_L - 8 && vx <= W - PAD_R + 8;
	hover.value = inside ? Math.min(Math.max(idx, 0), n - 1) : null;
}

// A range switch can leave hover past the new last index.
watch(
	() => props.labels.length,
	(n) => {
		if (hover.value != null && hover.value > n - 1) hover.value = null;
	},
);

const tooltipLeft = computed(() => {
	const scale = wrapW.value ? wrapW.value / W : 0;
	return `${xFor(hover.value ?? 0) * scale}px`;
});

const tooltipFlip = computed(() => {
	const scale = wrapW.value ? wrapW.value / W : 0;
	return xFor(hover.value ?? 0) * scale > wrapW.value * 0.62;
});
</script>

<style scoped>
.chart-wrap {
	position: relative;
	padding-top: 18px;
	user-select: none;
}

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

.area {
	stroke: none;
}

.line {
	fill: none;
	stroke-width: 2;
	stroke-linejoin: round;
	stroke-linecap: round;
}

.guide {
	stroke: var(--byf-text-dim);
	stroke-width: 1;
	stroke-dasharray: 3 3;
	opacity: 0.5;
}

.dot {
	stroke: var(--byf-surface);
	stroke-width: 1.5;
}

.legend {
	display: flex;
	justify-content: center;
	gap: 16px;
	padding-top: 8px;
	font-size: 12px;
	color: var(--byf-text);
}

.legend-item {
	display: inline-flex;
	align-items: center;
	gap: 6px;
}

.legend-swatch {
	width: 14px;
	height: 3px;
	border-radius: 2px;
}

.tooltip {
	position: absolute;
	top: 0;
	display: flex;
	flex-direction: column;
	gap: 2px;
	padding: 6px 10px;
	background: var(--byf-raised);
	border: 1px solid var(--byf-border);
	border-radius: 8px;
	box-shadow: 0 2px 12px rgba(0, 0, 0, 0.15);
	font-size: 12px;
	color: var(--byf-text);
	white-space: nowrap;
	pointer-events: none;
	translate: -8px 0;
}

.tooltip.flip {
	translate: calc(-100% + 8px) 0;
}

.tooltip-date {
	font-size: 11px;
	color: var(--byf-text-dim);
}

.tooltip-row {
	display: inline-flex;
	align-items: center;
	gap: 6px;
}

.tooltip-marker {
	width: 8px;
	height: 8px;
	border-radius: 4px;
}
</style>
