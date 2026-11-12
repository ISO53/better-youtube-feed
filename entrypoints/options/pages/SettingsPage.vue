<template>
	<div class="settings-page">
		<h1 class="page-title">Settings</h1>

		<SettingsGroup title="Watched videos">
			<SettingsRow label="Hide watched videos" desc="Videos you already watched disappear from your feed">
				<ToggleSwitch :model-value="settings.hideWatched" label="Hide watched videos"
					@update:model-value="onHideToggle" />
			</SettingsRow>

			<SettingsRow label="Watched threshold" desc="Minimum watch progress before a video counts as watched">
				<div class="threshold">
					<SliderInput :model-value="settings.watchedThresholdPct" :min="10" :step="10"
						label="Watched threshold" @update:model-value="onThreshold" />
					<span class="threshold-value">{{ settings.watchedThresholdPct }}%</span>
				</div>
			</SettingsRow>
		</SettingsGroup>

		<SettingsGroup title="Watch recording">
			<SettingsRow label="Record watches" desc="Mark videos as watched here when you play them past the threshold">
				<ToggleSwitch :model-value="settings.recordWatches" label="Record watches"
					@update:model-value="onRecordToggle" />
			</SettingsRow>
		</SettingsGroup>
	</div>
</template>

<script setup>
import { onBeforeUnmount, onMounted, reactive } from 'vue';

import SettingsGroup from '../../../components/ui/SettingsGroup.vue';
import SettingsRow from '../../../components/ui/SettingsRow.vue';
import SliderInput from '../../../components/ui/SliderInput.vue';
import ToggleSwitch from '../../../components/ui/ToggleSwitch.vue';
import { recordSettingsChange } from '../../../lib/events.js';
import { getSettings, setSettings } from '../../../lib/settings.js';

// Settings live-save via explicit handlers (v-model would also fire on load).
const settings = reactive({ hideWatched: true, watchedThresholdPct: 50, recordWatches: true });

let thresholdTimer = null;

onMounted(async () => {
	const stored = await getSettings();
	// 0% threshold is not offered; clamp any stored 0 up to the slider minimum.
	settings.watchedThresholdPct = Math.max(10, stored.watchedThresholdPct);
	settings.hideWatched = stored.hideWatched;
	settings.recordWatches = stored.recordWatches;
});

onBeforeUnmount(() => clearTimeout(thresholdTimer));

function onHideToggle(value) {
	settings.hideWatched = value;
	setSettings({ hideWatched: value });
	recordSettingsChange(`Hide watched videos turned ${value ? 'on' : 'off'}`);
}

function onRecordToggle(value) {
	settings.recordWatches = value;
	setSettings({ recordWatches: value });
	recordSettingsChange(`Watch recording turned ${value ? 'on' : 'off'}`);
}

function onThreshold(value) {
	settings.watchedThresholdPct = value;
	setSettings({ watchedThresholdPct: value });
	// Log once per drag, not per step.
	clearTimeout(thresholdTimer);
	thresholdTimer = setTimeout(
		() => recordSettingsChange(`Watched threshold set to ${value}%`),
		600,
	);
}
</script>

<style scoped>
.settings-page {
	display: flex;
	flex-direction: column;
	gap: 24px;
}

.page-title {
	margin: 0 0 8px;
	font-size: 24px;
	font-weight: 500;
	color: var(--byf-text);
}

.threshold {
	display: flex;
	align-items: center;
	gap: 12px;
}

.threshold-value {
	min-width: 38px;
	font-size: 13px;
	color: var(--byf-text);
	text-align: right;
}
</style>
