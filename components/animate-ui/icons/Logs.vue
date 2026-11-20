<script lang="ts">
import type { Variants } from 'motion-v'
import type { IconProps } from '@animate-ui/vue/icons'

export type LogsProps = IconProps<keyof typeof animations>;

// Lucide "logs" (nine horizontal strokes) is not in the Animate UI registry
// yet; authored here following the official icon component pattern. Each row
// redraws left to right, staggered top to bottom.
export const animations = {
	default: {
		dot1: {
			initial: { opacity: 1 },
			animate: { opacity: [0, 1], transition: { duration: 0.3, delay: 0 } },
		},
		dot2: {
			initial: { opacity: 1 },
			animate: { opacity: [0, 1], transition: { duration: 0.3, delay: 0.1 } },
		},
		dot3: {
			initial: { opacity: 1 },
			animate: { opacity: [0, 1], transition: { duration: 0.3, delay: 0.2 } },
		},
		dot4: {
			initial: { opacity: 1 },
			animate: { opacity: [0, 1], transition: { duration: 0.3, delay: 0 } },
		},
		dot5: {
			initial: { opacity: 1 },
			animate: { opacity: [0, 1], transition: { duration: 0.3, delay: 0.1 } },
		},
		dot6: {
			initial: { opacity: 1 },
			animate: { opacity: [0, 1], transition: { duration: 0.3, delay: 0.2 } },
		},
		line1: {
			initial: { x2: 21 },
			animate: { x2: [13, 21], transition: { duration: 0.4, ease: 'easeInOut', delay: 0 } },
		},
		line2: {
			initial: { x2: 21 },
			animate: { x2: [13, 21], transition: { duration: 0.4, ease: 'easeInOut', delay: 0.1 } },
		},
		line3: {
			initial: { x2: 21 },
			animate: { x2: [13, 21], transition: { duration: 0.4, ease: 'easeInOut', delay: 0.2 } },
		},
	} satisfies Record<string, Variants>,
} as const;
</script>

<script setup lang="ts">
import { IconWrapper } from '@animate-ui/vue/icons'
import { motion } from 'motion-v'

defineOptions({ name: 'Logs', inheritAttrs: false })
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
			<motion.line
				x1="3"
				y1="5"
				x2="4"
				y2="5"
				:variants="variants.dot1"
				initial="initial"
				:animate="controls"
			/>
			<motion.line
				x1="3"
				y1="12"
				x2="4"
				y2="12"
				:variants="variants.dot2"
				initial="initial"
				:animate="controls"
			/>
			<motion.line
				x1="3"
				y1="19"
				x2="4"
				y2="19"
				:variants="variants.dot3"
				initial="initial"
				:animate="controls"
			/>
			<motion.line
				x1="8"
				y1="5"
				x2="9"
				y2="5"
				:variants="variants.dot4"
				initial="initial"
				:animate="controls"
			/>
			<motion.line
				x1="8"
				y1="12"
				x2="9"
				y2="12"
				:variants="variants.dot5"
				initial="initial"
				:animate="controls"
			/>
			<motion.line
				x1="8"
				y1="19"
				x2="9"
				y2="19"
				:variants="variants.dot6"
				initial="initial"
				:animate="controls"
			/>
			<motion.line
				x1="13"
				y1="5"
				x2="21"
				y2="5"
				:variants="variants.line1"
				initial="initial"
				:animate="controls"
			/>
			<motion.line
				x1="13"
				y1="12"
				x2="21"
				y2="12"
				:variants="variants.line2"
				initial="initial"
				:animate="controls"
			/>
			<motion.line
				x1="13"
				y1="19"
				x2="21"
				y2="19"
				:variants="variants.line3"
				initial="initial"
				:animate="controls"
			/>
		</motion.svg>
	</IconWrapper>
</template>
