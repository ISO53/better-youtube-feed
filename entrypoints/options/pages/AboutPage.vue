<template>
	<div class="about-page">
		<h1 class="page-title">About</h1>

		<section class="identity">
			<img class="logo" src="/icon/icon.svg" alt="" />
			<div class="id-text">
				<span class="name">
					Better Youtube Feed
					<span class="version">v{{ version }}</span>
				</span>
				<p class="tagline">
					Stops YouTube from recommending videos you've already watched or keep
					ignoring and tells YouTube what you don't want, so your feed gets
					better over time. All data stays in your browser: there is no server
					and no telemetry.
				</p>
			</div>
		</section>

		<SettingsGroup title="Project">
			<SettingsRow label="Author" desc="The person behind the extension">
				<a class="link" :href="AUTHOR_URL" target="_blank" rel="noreferrer">ISO53 ↗</a>
			</SettingsRow>
			<SettingsRow label="Source code" desc="Read, report and contribute on GitHub">
				<a class="link" :href="REPO_URL" target="_blank" rel="noreferrer">ISO53/better-youtube-feed ↗</a>
			</SettingsRow>
			<SettingsRow label="Leave a star" desc="It takes two seconds and helps others find the extension">
				<a class="link" :href="REPO_URL" target="_blank" rel="noreferrer">★ Star on GitHub</a>
			</SettingsRow>
			<SettingsRow label="Report an issue" desc="Found a bug or have an idea?">
				<a class="link" :href="ISSUES_URL" target="_blank" rel="noreferrer">Open an issue ↗</a>
			</SettingsRow>
		</SettingsGroup>

		<SettingsGroup title="Legal">
			<SettingsRow label="License" desc="Free to use, study, share and modify">
				<span class="license">GPL-3.0</span>
			</SettingsRow>
			<SettingsRow label="Privacy" desc="No server, no telemetry, no accounts">
				<span class="license">100% local</span>
			</SettingsRow>
		</SettingsGroup>
	</div>
</template>

<script setup>
import { browser } from 'wxt/browser';

import SettingsGroup from '../../../components/ui/SettingsGroup.vue';
import SettingsRow from '../../../components/ui/SettingsRow.vue';

const REPO_URL = 'https://github.com/ISO53/better-youtube-feed';
const AUTHOR_URL = 'https://github.com/ISO53';
const ISSUES_URL = `${REPO_URL}/issues`;

const version = browser.runtime.getManifest().version;
</script>

<style scoped>
.about-page {
	display: flex;
	flex-direction: column;
	gap: 24px;
}

.page-title {
	margin: 0;
	font-size: 24px;
	font-weight: 500;
	color: var(--byf-text);
}

.identity {
	display: flex;
	align-items: stretch;
	gap: 20px;
	padding: 20px;
	background: var(--byf-raised);
	border-radius: 12px;
}

.logo {
	width: 80px;
	align-self: stretch;
	aspect-ratio: 1;
	object-fit: cover;
	border-radius: 12px;
}

.id-text {
	display: flex;
	flex-direction: column;
	gap: 8px;
}

.name {
	display: flex;
	align-items: center;
	gap: 10px;
	font-size: 18px;
	font-weight: 500;
	color: var(--byf-text);
}

.version {
	padding: 3px 9px;
	background: var(--byf-hover);
	border-radius: 11px;
	font-size: 11px;
	font-weight: 500;
	color: var(--byf-text-dim);
}

.tagline {
	margin: 0;
	font-size: 13px;
	line-height: 1.55;
	color: var(--byf-text-dim);
}

.link {
	font-size: 13px;
	font-weight: 500;
	color: var(--byf-link);
	text-decoration: none;
}

.link:hover {
	text-decoration: underline;
}

.license {
	font-size: 13px;
	font-weight: 500;
	color: var(--byf-text);
}
</style>
