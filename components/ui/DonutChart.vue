<template>
	<!-- Decorative: the legend and nearby text carry the numbers. -->
	<svg :viewBox="`0 0 ${SIZE} ${SIZE}`" class="donut" aria-hidden="true">
		<g :transform="`rotate(${rotation} ${C} ${C})`">
			<circle v-for="(seg, si) in segments" :key="'seg' + si" class="seg" :cx="C" :cy="C"
				:r="radius(seg.ring)" :stroke="seg.color" :stroke-width="STROKE" :stroke-linecap="linecap"
				:style="{ strokeDasharray: seg.dash, strokeDashoffset: seg.offset }" />
		</g>
	</svg>
</template>

<script setup>
import { computed } from 'vue';

// Multi-ring donut (nested circles). Each ring's segments are proportional
// slices of that ring's total — or of its explicit `max`, so a single
// segment can read as a partial share — drawn clockwise from 12 o'clock
// with rounded caps; a gap between full-circle segments keeps neighbours
// visually separate. Zero-value segments are skipped; no track is drawn.
// With `span` < 360 the arcs cover only the last `span` degrees ending at
// 12 o'clock (e.g. 90 = a quarter gauge for corner placement) and the caps
// go flat so small arcs stay length-accurate.
// New arcs grow in via the .seg keyframes animation (insertion-triggered,
// zero-length → the element's own dash), so every ring animates on first
// open; later value changes tween through the transition instead.
const props = defineProps({
	/** @type {{max?: number, segments: {value: number, color: string}[]}[]} - outermost first */
	rings: { type: Array, required: true },
	/** Arc span in degrees, ending at 12 o'clock. Default: full circle. */
	span: { type: Number, default: 360 },
});

const SIZE = 130;
const C = SIZE / 2;
const STROKE = 12;
const R_OUTER = 52;
const RING_STEP = 15;
// Arc degrees kept free between two segments of a full-circle ring. Rounded
// caps protrude STROKE/2 into it, so it stays visible.
const GAP_DEG = 14;

const radius = (ringIndex) => R_OUTER - ringIndex * RING_STEP;

// Dash start sits at 3 o'clock; rotate the group so arcs end at 12 o'clock.
const rotation = computed(() => 270 - props.span);
const linecap = computed(() => (props.span >= 360 ? 'round' : 'butt'));

const segments = computed(() => {
	const out = [];
	props.rings.forEach((ring, ri) => {
		const segs = (ring.segments ?? []).filter((s) => s.value > 0);
		if (!segs.length) return;
		const total = ring.max ?? segs.reduce((sum, s) => sum + s.value, 0);
		if (total <= 0) return;
		const circ = 2 * Math.PI * radius(ri);
		const gapDeg = segs.length > 1 && props.span >= 360 ? GAP_DEG : 0;
		let accDeg = 0;
		for (const seg of segs) {
			const sweepDeg = Math.min((seg.value / total) * props.span, props.span - accDeg);
			if (sweepDeg <= 0) break;
			const len = (Math.max(sweepDeg - gapDeg, 0.5) / 360) * circ;
			out.push({
				ring: ri,
				color: seg.color,
				// dashoffset shifts the dash start clockwise from 3 o'clock;
				// the group rotation puts that start at the span's first degree.
				dash: `${len} ${circ - len}`,
				offset: -((accDeg + gapDeg / 2) / 360) * circ,
			});
			accDeg += sweepDeg;
		}
	});
	return out;
});
</script>

<style scoped>
.donut {
	display: block;
	width: 100%;
	height: auto;
}

.seg {
	fill: none;
	animation: byf-arc-in 0.6s ease backwards;
	transition: stroke-dasharray 0.6s ease, stroke-dashoffset 0.6s ease;
}

/* Insertion grow-in: a zero-length dash overrides the styled one only for
   the first frame; `to` is the element's own dash value. */
@keyframes byf-arc-in {
	from {
		stroke-dasharray: 0 999;
	}
}
</style>
