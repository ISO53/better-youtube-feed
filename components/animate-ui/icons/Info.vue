<script lang="ts">
import type { Variants } from 'motion-v'
import type { IconProps } from '@animate-ui/vue/icons'

export type InfoProps = IconProps<keyof typeof animations>;

export const animations = {
	default: {
		path: {
			initial: {
				pathLength: 1,
				opacity: 1,
				scale: 1,
			},
			animate: {
				pathLength: [0, 1],
				opacity: [0, 1],
				scale: [1, 1.1, 1],
				transition: {
					duration: 0.6,
					ease: 'easeInOut',
				},
			},
		},
	},
} satisfies Record<string, Variants>;
</script>

<script setup lang="ts">
import { IconWrapper } from '@animate-ui/vue/icons'
import { motion } from 'motion-v'

defineOptions({ name: 'Info', inheritAttrs: false })
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
			initial="initial"
			:animate="controls"
			v-bind="attrs"
		>
			<motion.circle cx="12" cy="12" r="10" :variants="variants.path" initial="initial" :animate="controls" />
			<motion.path d="M12 16v-4" :variants="variants.path" initial="initial" :animate="controls" />
			<motion.path d="M12 8h.01" :variants="variants.path" initial="initial" :animate="controls" />
		</motion.svg>
	</IconWrapper>
</template>
