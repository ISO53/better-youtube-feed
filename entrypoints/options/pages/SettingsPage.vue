<template>
	<div class="settings-page">
		<h1 class="page-title">Settings</h1>

		<SettingsGroup title="Watched videos">
			<SettingsRow label="Hide watched videos" desc="Videos you already watched disappear from your feed">
				<ToggleSwitch v-model="settings.hideWatched" label="Hide watched videos" />
			</SettingsRow>

			<SettingsRow label="Watched threshold" desc="Minimum watch progress before a video counts as watched">
				<div class="threshold">
					<SliderInput v-model="settings.watchedThresholdPct" :min="10" :step="10"
						label="Watched threshold" />
					<span class="threshold-value">{{ settings.watchedThresholdPct }}%</span>
				</div>
			</SettingsRow>
		</SettingsGroup>
	</div>
</template>

<script setup>
import { onMounted, reactive, watch } from 'vue';

import SettingsGroup from '../../../components/ui/SettingsGroup.vue';
import SettingsRow from '../../../components/ui/SettingsRow.vue';
import SliderInput from '../../../components/ui/SliderInput.vue';
import ToggleSwitch from '../../../components/ui/ToggleSwitch.vue';
import { getSettings, setSettings } from '../../../lib/settings.js';

// Settings live-save: any change is written to storage immediately;
// the content script reacts to storage changes live.
const settings = reactive({ hideWatched: true, watchedThresholdPct: 50 });

onMounted(async () => {
	const stored = await getSettings();
	// 0% threshold is not offered; clamp any stored 0 up to the slider minimum.
	settings.watchedThresholdPct = Math.max(10, stored.watchedThresholdPct);
	settings.hideWatched = stored.hideWatched;
});

watch(settings, (value) => {
	setSettings({ ...value });
});
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
