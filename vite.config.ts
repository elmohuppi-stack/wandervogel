import adapter from '@sveltejs/adapter-node';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		sveltekit({
			compilerOptions: {
				// Runes-Modus für eigenen Code erzwingen, Bibliotheken ausgenommen.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			// adapter-node: ein Node-Prozess, ein Docker-Image, ein kleiner Server.
			adapter: adapter()
		})
	],
	server: {
		// 5173 ist auf diesem Rechner belegt, auf 3010 läuft Wanderer.
		port: 5180,
		strictPort: true,
		// Damit die Feldansicht vom Handy im gleichen WLAN erreichbar ist.
		host: true
	},
	optimizeDeps: {
		/**
		 * maplibre-gl muss aus der Dependency-Optimierung heraus.
		 *
		 * Sonst bündelt Vite die Bibliothek vor, dabei wird ihr Web Worker
		 * (`maplibre-gl-worker.mjs`) unauffindbar und schlägt mit
		 * ERR_FAILED fehl. Ohne Worker verarbeitet MapLibre keine Kacheln:
		 * die Karte bleibt vollständig leer, und zwar ohne eine einzige
		 * Fehlermeldung in der Konsole.
		 */
		exclude: ['maplibre-gl']
	}
});
