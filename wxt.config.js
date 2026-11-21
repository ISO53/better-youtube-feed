import { defineConfig } from 'wxt';

// See https://wxt.dev/api/reference/wxt/interfaces/inlineconfig.html
export default defineConfig({
	modules: ['@wxt-dev/module-vue'],
	manifest: {
		name: 'Better Youtube Feed',
		description:
			"Stop YouTube from recommending videos you've already watched or keep ignoring. All data stays in your browser.",
		permissions: ['storage'],
	},
	// Stable release filenames: the version lives in the manifest, not the zip name.
	zip: {
		artifactTemplate: '{{name}}-{{browser}}.zip',
		sourcesTemplate: '{{name}}-{{browser}}-sources.zip',
	},
});
