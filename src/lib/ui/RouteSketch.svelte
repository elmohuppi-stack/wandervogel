<script lang="ts">
	/**
	 * Der Umriss einer Tour als Vorschaubild.
	 *
	 * Komoot zeigt an dieser Stelle Nutzerfotos. Es gibt keine, und beide
	 * Alternativen scheitern an den Anforderungen: eine Kartengrafik
	 * serverseitig zu rendern bräuchte ein headless MapLibre samt
	 * Netzzugriff, ein Static-Map-Dienst wäre ein Fremddienst im
	 * Dauerbetrieb.
	 *
	 * Also die Form der Tour selbst. Sie gibt sich nicht als Karte aus — und
	 * unterscheidet zwei Touren auf einen Blick besser als ein Gipfelfoto,
	 * von denen ohnehin alle gleich aussehen.
	 *
	 * Zwischengespeichert wird nichts, und das ist Absicht: der teure Teil,
	 * das Vereinfachen von tausenden Stützpunkten auf achtzig, steckt schon
	 * in der Spalte geom_overview. Was hier bleibt, sind ein paar Mikro-
	 * sekunden Pfadbau in einem $derived, serverseitig gerendert. Wenn die
	 * Liste je langsam wird, ist die Antwort Blättern, nicht ein Bildcache.
	 */
	import type { ActivityType } from '$lib/geo/activity';

	interface Props {
		/** Vereinfachte Linie `[lon, lat]`. */
		outline: [number, number][];
		activityType: ActivityType;
		width?: number;
		height?: number;
	}

	let { outline, width = 96, height = 64 }: Props = $props();

	const PAD = 6;

	const d = $derived.by(() => {
		if (!outline || outline.length < 2) return '';

		// Nach Web-Mercator: eine reine Lon/Lat-Abbildung staucht eine Tour
		// auf 49° Nord sichtbar in der Höhe.
		//
		// Beide Achsen im Bogenmaß. Mit Grad für x und Bogenmaß für y wäre x
		// um den Faktor 180/π gestreckt — jede Tour sähe aus wie ein
		// waagerechter Strich. Genau so war der erste Versuch.
		const pts = outline.map(([lon, lat]) => {
			const φ = (lat * Math.PI) / 180;
			const λ = (lon * Math.PI) / 180;
			return [λ, Math.log(Math.tan(Math.PI / 4 + φ / 2))] as [number, number];
		});

		let minX = Infinity;
		let minY = Infinity;
		let maxX = -Infinity;
		let maxY = -Infinity;
		for (const [x, y] of pts) {
			if (x < minX) minX = x;
			if (y < minY) minY = y;
			if (x > maxX) maxX = x;
			if (y > maxY) maxY = y;
		}

		const dx = maxX - minX || 1e-9;
		const dy = maxY - minY || 1e-9;

		// Ein gemeinsamer Maßstab, damit das Seitenverhältnis stimmt: eine
		// lange Ost-West-Tour bleibt ein Strich, eine Runde bleibt eine
		// Runde. Getrennt normalisiert sähe alles gleich aus.
		const s = Math.min((width - 2 * PAD) / dx, (height - 2 * PAD) / dy);
		const ox = (width - dx * s) / 2;
		const oy = (height - dy * s) / 2;

		return pts
			.map(([x, y], i) => {
				const px = ox + (x - minX) * s;
				// y auf dem Bildschirm wächst nach unten.
				const py = height - oy - (y - minY) * s;
				return `${i ? 'L' : 'M'}${px.toFixed(1)} ${py.toFixed(1)}`;
			})
			.join('');
	});
</script>

<svg class="sketch" viewBox="0 0 {width} {height}" width={width} height={height} aria-hidden="true">
	{#if d}
		<path class="fassung" {d} />
		<path class="linie" {d} />
	{/if}
</svg>

<style>
	.sketch {
		display: block;
		flex: none;
		border-radius: var(--r-sm);
		background: var(--paper-2);
	}

	path {
		fill: none;
		stroke-linecap: round;
		stroke-linejoin: round;
	}

	/* Dieselbe Lesbarkeitshilfe wie auf der Karte. */
	.fassung {
		stroke: var(--surface);
		stroke-width: 3.5;
	}

	.linie {
		stroke: var(--route);
		stroke-width: 1.6;
	}
</style>
