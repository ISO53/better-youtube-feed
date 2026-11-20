// Shared visual composition for the "Removed from your feed" card, used by
// both the stats page and the popup so the two never drift apart.

/**
 * Donut rings, each a share of the ring outside it: how the removed videos
 * split (watched vs ignored), how many of them got a Not-interested signal,
 * and how many YouTube served again anyway.
 * @param {{hidden: number, hiddenWatched: number, hiddenIgnored: number}} feed
 * @param {{sent: number, resurfaced: number}} feedback
 */
export function buildDonutRings(feed, feedback) {
	return [
		{
			max: feed.hidden,
			segments: [
				{ value: feed.hiddenWatched, color: 'var(--byf-chart-1)' },
				{ value: feed.hiddenIgnored, color: 'var(--byf-chart-3)' },
			],
		},
		{
			max: feed.hidden,
			segments: [{ value: Math.min(feedback.sent, feed.hidden), color: 'var(--byf-chart-2)' }],
		},
		{
			max: feedback.sent,
			segments: [{ value: Math.min(feedback.resurfaced, feedback.sent), color: 'var(--byf-chart-4)' }],
		},
	];
}

/**
 * Legend entries matching the rings, strongest shade → palest.
 * @param {{hiddenWatched: number, hiddenIgnored: number}} feed
 * @param {{sent: number, resurfaced: number}} feedback
 */
export function buildLegendItems(feed, feedback) {
	return [
		{
			label: 'Hidden · already watched',
			value: `${feed.hiddenWatched.toLocaleString()} videos`,
			color: 'var(--byf-chart-1)',
		},
		{
			label: 'Hidden · kept ignoring',
			value: `${feed.hiddenIgnored.toLocaleString()} videos`,
			color: 'var(--byf-chart-3)',
		},
		{
			label: 'Not-interested sent',
			value: `${feedback.sent.toLocaleString()} signals`,
			color: 'var(--byf-chart-2)',
		},
		{
			label: 'Came back anyway',
			value: `${feedback.resurfaced.toLocaleString()} videos`,
			color: 'var(--byf-chart-4)',
		},
	];
}
