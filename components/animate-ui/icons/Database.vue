<script lang="ts">
import type { Variants } from 'motion-v'
import type { IconProps } from '@animate-ui/vue/icons'

export type DatabaseProps = IconProps<keyof typeof animations>;

// Lucide "database" (ellipse cx12 cy5 rx9 ry3) is not in the Animate UI
// registry yet; authored here following the official icon component pattern.
export const animations = {
	default: {
		ellipse: {
			initial: { cy: 5, ry: 3 },
			animate: {
				cy: [5, 6.5, 5],
				ry: [3, 2.25, 3],
				transition: { duration: 0.6, ease: 'easeInOut' },
			},
		},
		path1: {},
		path2: {
			initial: { y: 0 },
			animate: {
				y: [0, 1.5, 0],
				transition: { duration: 0.6, ease: 'easeInOut' },
			},
		},
	} satisfies Record<string, Variants>,
} as const;
</script>

<script setup lang="ts">
import { IconWrapper } from '@animate-ui/vue/icons'
import { motion } from 'motion-v'

defineOptions({ name: 'Database', inheritAttrs: false })
</script>

<template>
	<IconWrapper
		v-slot="{ variants, controls, size, attrs }"
		:animations="animations"
		v-bind="$attrs"
	>
		<motion.svg
			:width="size"
			:height="size"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			:stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
			v-bind="attrs"
		>
			<motion.ellipse
				:cx="12"
				:cy="5"
				:rx="9"
				:ry="3"
				:variants="variants.ellipse"
				initial="initial"
				:animate="controls"
			/>
			<motion.path
				d="M3 5V19A9 3 0 0 0 21 19V5"
				:variants="variants.path1"
				initial="initial"
				:animate="controls"
			/>
			<motion.path
				d="M3 12A9 3 0 0 0 21 12"
				:variants="variants.path2"
				initial="initial"
				:animate="controls"
			/>
		</motion.svg>
	</IconWrapper>
</template>
