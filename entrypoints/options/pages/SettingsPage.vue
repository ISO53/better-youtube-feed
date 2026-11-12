<template>
	<div class="settings-page">
		<h1 class="page-title">Settings</h1>

		<SettingsGroup title="Watched videos">
			<SettingsRow label="Hide watched videos" desc="Videos you already watched disappear from your feed">
				<ToggleSwitch :model-value="settings.hideWatched" label="Hide watched videos"
					@update:model-value="onHideToggle" />
			</SettingsRow>

			<SettingsRow label="Watched threshold" desc="Minimum watch progress before a video counts as watched"
				:disabled="!settings.hideWatched">
				<div class="threshold">
					<SliderInput :model-value="settings.watchedThresholdPct" :min="10" :step="10"
						label="Watched threshold" :disabled="!settings.hideWatched" @update:model-value="onThreshold" />
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

		<SettingsGroup title="Ignored videos">
			<SettingsRow label="Hide ignored videos">
				<template #desc>
					<span class="desc">Videos you saw <b>{{ settings.ignoreThreshold }} times</b> in the
						past <b>{{ settings.ignoreWindowDays }} days</b> without watching them will disappear from your feed.</span>
				</template>
				<ToggleSwitch :model-value="settings.hideIgnored" label="Hide ignored videos"
					@update:model-value="onIgnoredToggle" />
			</SettingsRow>

			<SettingsRow label="Ignore threshold" desc="Sightings within the window before a video counts as ignored"
				:disabled="!settings.hideIgnored">
				<div class="threshold">
					<SliderInput :model-value="settings.ignoreThreshold" :min="3" :max="10" :step="1"
						label="Ignore threshold" :disabled="!settings.hideIgnored" @update:model-value="onIgnoreThreshold" />
					<span class="threshold-value">{{ settings.ignoreThreshold }}×</span>
				</div>
			</SettingsRow>

			<SettingsRow label="Within" desc="How far back sightings are counted" :disabled="!settings.hideIgnored">
				<div class="threshold">
					<SliderInput :model-value="settings.ignoreWindowDays" :min="7" :max="30" :step="1"
						label="Exposure window" :disabled="!settings.hideIgnored" @update:model-value="onIgnoreWindow" />
					<span class="threshold-value">{{ settings.ignoreWindowDays }} days</span>
				</div>
			</SettingsRow>
		</SettingsGroup>

		<SettingsGroup title="Feedback">
			<SettingsRow label="Send feedback"
				desc="Send YouTube's own Not interested signal for hidden videos, so recommendations improve over time">
				<ToggleSwitch :model-value="settings.sendFeedback" label="Send feedback"
					@update:model-value="onFeedbackToggle" />
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
const settings = reactive({
	hideWatched: true,
	watchedThresholdPct: 50,
	recordWatches: true,
	hideIgnored: true,
	ignoreThreshold: 5,
	ignoreWindowDays: 14,
	sendFeedback: true,
});

let thresholdTimer = null;
let ignoreTimer = null;
let windowTimer = null;

onMounted(async () => {
	const stored = await getSettings();
	// 0% threshold is not offered; clamp any stored 0 up to the slider minimum.
	settings.watchedThresholdPct = Math.max(10, stored.watchedThresholdPct);
	settings.hideWatched = stored.hideWatched;
	settings.recordWatches = stored.recordWatches;
	settings.hideIgnored = stored.hideIgnored;
	settings.ignoreThreshold = stored.ignoreThreshold;
	settings.ignoreWindowDays = stored.ignoreWindowDays;
	settings.sendFeedback = stored.sendFeedback;
});

onBeforeUnmount(() => {
	clearTimeout(thresholdTimer);
	clearTimeout(ignoreTimer);
	clearTimeout(windowTimer);
});

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

function onIgnoredToggle(value) {
	settings.hideIgnored = value;
	setSettings({ hideIgnored: value });
	recordSettingsChange(`Hide ignored videos turned ${value ? 'on' : 'off'}`);
}

function onIgnoreThreshold(value) {
	settings.ignoreThreshold = value;
	setSettings({ ignoreThreshold: value });
	clearTimeout(ignoreTimer);
	ignoreTimer = setTimeout(
		() => recordSettingsChange(`Ignore threshold set to ${value}x`),
		600,
	);
}

function onFeedbackToggle(value) {
	settings.sendFeedback = value;
	setSettings({ sendFeedback: value });
	recordSettingsChange(`Send feedback turned ${value ? 'on' : 'off'}`);
}

function onIgnoreWindow(value) {
	settings.ignoreWindowDays = value;
	setSettings({ ignoreWindowDays: value });
	clearTimeout(windowTimer);
	windowTimer = setTimeout(
		() => recordSettingsChange(`Exposure window set to ${value} days`),
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

.desc {
	display: block;
	margin-top: 4px;
	font-size: 12px;
	color: var(--byf-text-dim);
}

.desc b {
	font-weight: 500;
	color: var(--byf-text);
}
</style>
