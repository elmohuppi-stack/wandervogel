<script lang="ts">
	/**
	 * Eine vorhandene Route zur eigenen Tour machen — Weg B und C aus den
	 * Anforderungen 6.2.
	 *
	 * Zwei Türen, ein Ziel: eine markierte OSM-Route nach Namen suchen, oder
	 * eine GPX-Datei lesen. Beides landet erst als *Vorschau* auf der Karte —
	 * gestrichelt, mit Kennzahlen und Untergrund — und wird erst auf
	 * ausdrücklichen Knopfdruck zur Tour. Eine Übernahme, die den aktuellen
	 * Stand überschreibt, darf nicht aus Versehen passieren.
	 */
	import { activity, type ActivityType } from '$lib/geo/activity';
	import * as fmt from '$lib/format';
	import { parseGpx } from '$lib/tour/gpx';
	import { hasElevation, type Punkt3 } from '$lib/tour/uebernehmen';
	import Alert from '$lib/ui/Alert.svelte';
	import Button from '$lib/ui/Button.svelte';
	import Icon from '$lib/ui/Icon.svelte';
	import IconButton from '$lib/ui/IconButton.svelte';

	interface Treffer {
		id: number;
		name: string;
		ref?: string;
		operator?: string;
		stufe?: string;
	}

	export interface Vorschau {
		name: string;
		markierung?: string;
		operator?: string;
		stufe?: string;
		itinerary?: string[];
		lengthM: number;
		coordinates: Punkt3[];
		surfaces: { art: string; anteil: number }[];
		/** Aus einer GPX-Datei mit Höhen: die Linie *ist* die Route. */
		mitHoehen: boolean;
	}

	interface Props {
		activityType: ActivityType;
		/** Vorschau für die Karte — die Seite gibt sie an MapCanvas weiter. */
		vorschau: Vorschau | null;
		/** Übernahme läuft — Höhen holen dauert bei einem Fernweg. */
		laeuftUebernahme?: boolean;
		onAdopt: (v: Vorschau) => void;
	}

	let {
		activityType,
		vorschau = $bindable(),
		laeuftUebernahme = false,
		onAdopt
	}: Props = $props();

	let offen = $state(false);
	let text = $state('');
	let treffer = $state<Treffer[]>([]);
	let laeuft = $state(false);
	let fehler = $state<string | null>(null);
	let feld: HTMLInputElement | undefined = $state();

	let timer: ReturnType<typeof setTimeout> | undefined;
	let lauf = 0;

	const def = $derived(activity(activityType));

	/** Von der Seite aus aufgerufen — der Knopf steht im Leerzustand. */
	export function routeSuchen() {
		vorschau = null;
		offen = true;
		// Nach dem Einhängen fokussieren, sonst gibt es das Feld noch nicht.
		setTimeout(() => feld?.focus(), 0);
	}

	export function gpxWaehlen() {
		vorschau = null;
		offen = false;
		dateifeld?.click();
	}

	function schliessen() {
		offen = false;
		text = '';
		treffer = [];
		fehler = null;
	}

	function getippt(v: string) {
		text = v;
		fehler = null;
		clearTimeout(timer);
		if (v.trim().length < 3) {
			treffer = [];
			return;
		}
		timer = setTimeout(() => void suchen(v.trim()), 400);
	}

	async function suchen(q: string) {
		const meins = ++lauf;
		laeuft = true;
		try {
			const res = await fetch(
				`/api/routen?q=${encodeURIComponent(q)}&activityType=${activityType}`
			);
			const d = await res.json();
			if (meins !== lauf) return;
			if (!res.ok) {
				fehler = d.error ?? 'Suche fehlgeschlagen';
				treffer = [];
			} else {
				treffer = d.results;
				if (treffer.length === 0) fehler = `Keine ${def.routeLayerLabel} mit diesem Namen.`;
			}
		} catch {
			if (meins === lauf) {
				fehler = 'Server nicht erreichbar';
				treffer = [];
			}
		} finally {
			if (meins === lauf) laeuft = false;
		}
	}

	async function laden(t: Treffer) {
		laeuft = true;
		fehler = null;
		try {
			const res = await fetch(`/api/routen/${t.id}?activityType=${activityType}`);
			const d = await res.json();
			if (!res.ok) {
				fehler = d.error ?? 'Route konnte nicht geladen werden';
				return;
			}
			vorschau = { ...d.route, mitHoehen: false };
			schliessen();
		} catch {
			fehler = 'Server nicht erreichbar';
		} finally {
			laeuft = false;
		}
	}

	/* --- GPX ------------------------------------------------------------- */

	let dateifeld: HTMLInputElement | undefined = $state();

	async function gpxGelesen(e: Event) {
		const datei = (e.currentTarget as HTMLInputElement).files?.[0];
		if (!datei) return;
		fehler = null;
		try {
			const { name, coordinates } = parseGpx(await datei.text());
			vorschau = {
				name: name ?? datei.name.replace(/\.gpx$/i, ''),
				lengthM: 0,
				coordinates,
				surfaces: [],
				mitHoehen: hasElevation(coordinates)
			};
			offen = false;
		} catch (err) {
			fehler = (err as Error).message;
		} finally {
			// Zurücksetzen, damit dieselbe Datei erneut gewählt werden kann.
			if (dateifeld) dateifeld.value = '';
		}
	}
</script>

<input
	bind:this={dateifeld}
	type="file"
	accept=".gpx,application/gpx+xml,application/xml,text/xml"
	class="visually-hidden"
	onchange={gpxGelesen}
	tabindex="-1"
	aria-hidden="true"
/>

{#if vorschau}
	<!-- Vorschau: was man bekommt, bevor man es nimmt. -->
	<div class="karte vorschau">
		<div class="kopf">
			<Icon name="route" size={16} />
			<div class="titel">
				<b>{vorschau.name}</b>
				{#if vorschau.stufe || vorschau.operator}
					<span class="unter">
						{[vorschau.stufe, vorschau.operator].filter(Boolean).join(' · ')}
					</span>
				{/if}
			</div>
			<IconButton icon="close" label="Vorschau verwerfen" onclick={() => (vorschau = null)} />
		</div>

		{#if vorschau.markierung}
			<p class="markierung"><Icon name="layers" size={12} /> {vorschau.markierung}</p>
		{/if}

		<dl class="zahlen">
			{#if vorschau.lengthM > 0}
				<div><dt>Länge</dt><dd class="num">{fmt.km(vorschau.lengthM)} km</dd></div>
			{/if}
			<div><dt>Stützpunkte</dt><dd class="num">{vorschau.coordinates.length}</dd></div>
			{#if vorschau.itinerary?.length}
				<div class="weit"><dt>Verlauf</dt><dd>{vorschau.itinerary.join(' – ')}</dd></div>
			{/if}
		</dl>

		{#if vorschau.surfaces.length > 0}
			<!-- Untergrund entlang der Route — ein MUSS aus 6.2, das erst mit
			     dieser Quelle erfüllbar wurde. -->
			<div class="untergrund">
				<span class="label">Untergrund</span>
				<div class="balken">
					{#each vorschau.surfaces as s (s.art)}
						<span
							class="teil"
							style="flex: {s.anteil}"
							title="{s.art} · {Math.round(s.anteil * 100)} %"
							data-art={s.art}
						></span>
					{/each}
				</div>
				<ul class="beine">
					{#each vorschau.surfaces as s (s.art)}
						<li><span class="punkt" data-art={s.art}></span>{s.art} {Math.round(s.anteil * 100)} %</li>
					{/each}
				</ul>
			</div>
		{/if}

		<p class="hinweis">
			Die Linie wird genau übernommen, nicht neu berechnet.
			{#if vorschau.mitHoehen}
				Die Datei bringt ihre Höhen mit.
			{:else}
				Die Höhen kommen aus demselben Höhenmodell, aus dem die Karte ihr Relief
				zeichnet — das dauert bei langen Wegen einen Moment.
			{/if}
			Ein paar Wegpunkte werden gesetzt, damit sich ein Stück herausschneiden lässt.
		</p>

		<div class="aktionen">
			<Button
				variant="primary"
				icon="check"
				loading={laeuftUebernahme}
				onclick={() => vorschau && onAdopt(vorschau)}
			>
				{laeuftUebernahme ? 'Höhen werden geholt …' : 'Als Tour übernehmen'}
			</Button>
			<Button variant="ghost" disabled={laeuftUebernahme} onclick={() => (vorschau = null)}>
				Verwerfen
			</Button>
		</div>
	</div>
{:else if offen}
	<div class="karte suche">
		<div class="feld">
			<Icon name="search" size={14} />
			<input
				bind:this={feld}
				type="text"
				placeholder="{def.routeLayerLabel} nach Namen suchen …"
				value={text}
				oninput={(e) => getippt(e.currentTarget.value)}
				onkeydown={(e) => e.key === 'Escape' && schliessen()}
				aria-label="Route nach Namen suchen"
				autocomplete="off"
				spellcheck="false"
			/>
			{#if laeuft}<Icon name="loader" size={14} class="spin" />{/if}
			<IconButton icon="close" label="Schließen" size="sm" onclick={schliessen} />
		</div>

		{#if fehler}
			<Alert tone="bad">{fehler}</Alert>
		{:else if treffer.length > 0}
			<ul class="liste">
				{#each treffer as t (t.id)}
					<li>
						<button type="button" onclick={() => laden(t)}>
							<Icon name="route" size={14} />
							<span>
								<b>{t.name}</b>
								<span class="unter">
									{[t.stufe, t.operator, t.ref].filter(Boolean).join(' · ')}
								</span>
							</span>
						</button>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="tipp">
				Zum Beispiel „Nibelungensteig", „Pfälzer Waldpfad" oder ein Kürzel wie „HW 3".
			</p>
		{/if}
	</div>
{/if}

<style>
	.karte {
		position: absolute;
		top: calc(var(--sp-5) + var(--hit-sm) + var(--sp-4));
		left: 50%;
		translate: -50% 0;
		z-index: var(--z-popover);
		width: min(30rem, calc(100% - 2 * var(--sp-6)));
		padding: var(--sp-5) var(--sp-6);
		background: var(--surface);
		border: 1px solid var(--edge);
		border-radius: var(--r-md);
		box-shadow: var(--el-3);
	}

	.kopf {
		display: flex;
		align-items: flex-start;
		gap: var(--sp-4);
		color: var(--ink-3);
	}

	.titel {
		flex: 1;
		min-width: 0;
	}

	b {
		display: block;
		color: var(--ink);
		font-size: var(--fs-base);
	}

	.unter {
		display: block;
		font-size: var(--fs-xs);
		color: var(--ink-3);
	}

	.markierung {
		display: flex;
		align-items: center;
		gap: var(--sp-3);
		margin: var(--sp-4) 0 0;
		font-size: var(--fs-sm);
		color: var(--ink-2);
	}

	.zahlen {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--sp-3) var(--sp-5);
		margin: var(--sp-5) 0 0;
	}
	.zahlen .weit {
		grid-column: 1 / -1;
	}
	dt {
		font-size: var(--fs-xs);
		color: var(--ink-3);
	}
	dd {
		margin: 0;
		font-size: var(--fs-sm);
		color: var(--ink);
	}

	.untergrund {
		margin-top: var(--sp-5);
	}

	.balken {
		display: flex;
		height: 8px;
		margin-top: var(--sp-3);
		border-radius: var(--r-pill);
		overflow: hidden;
		background: var(--surface-2);
	}
	.teil {
		min-width: 2px;
	}

	.beine {
		list-style: none;
		display: flex;
		flex-wrap: wrap;
		gap: var(--sp-2) var(--sp-5);
		margin: var(--sp-3) 0 0;
		padding: 0;
		font-size: var(--fs-xs);
		color: var(--ink-2);
	}
	.beine li {
		display: inline-flex;
		align-items: center;
		gap: var(--sp-2);
	}
	.punkt {
		width: 8px;
		height: 8px;
		border-radius: var(--r-pill);
	}

	/* Untergrund ist eine Eigenschaft der Karte, nicht der Oberfläche:
	   dieselben Farben, die eine gedruckte Wanderkarte benutzt. */
	[data-art='Asphalt'],
	[data-art='befestigt'],
	[data-art='Beton'],
	[data-art='Pflaster'] {
		background: #6b7280;
	}
	[data-art='verdichtet'],
	[data-art='Schotter'],
	[data-art='Feinschotter'] {
		background: #b08968;
	}
	[data-art='Naturboden'],
	[data-art='Erde'],
	[data-art='Wiese'],
	[data-art='Sand'] {
		background: #8a9a5b;
	}
	[data-art='unbekannt'] {
		background: var(--edge);
	}

	.hinweis {
		margin: var(--sp-5) 0 0;
		padding-top: var(--sp-4);
		border-top: 1px solid var(--edge-soft);
		font-size: var(--fs-xs);
		color: var(--ink-3);
		line-height: 1.5;
	}

	.aktionen {
		display: flex;
		gap: var(--sp-4);
		margin-top: var(--sp-5);
	}

	.feld {
		display: flex;
		align-items: center;
		gap: var(--sp-3);
		color: var(--ink-3);
	}
	.feld input {
		flex: 1;
		min-width: 0;
		padding: var(--sp-3) 0;
		border: 0;
		background: transparent;
		color: var(--ink);
		font: inherit;
		font-size: var(--fs-sm);
		outline: none;
	}
	.feld :global(.spin) {
		animation: spin 900ms linear infinite;
	}
	@keyframes spin {
		to {
			rotate: 360deg;
		}
	}

	.liste {
		list-style: none;
		margin: var(--sp-4) 0 0;
		padding: 0;
		max-height: 18rem;
		overflow-y: auto;
		border-top: 1px solid var(--edge-soft);
	}
	.liste button {
		display: flex;
		align-items: flex-start;
		gap: var(--sp-3);
		width: 100%;
		padding: var(--sp-4);
		border: 0;
		border-radius: var(--r-xs);
		background: transparent;
		color: var(--ink-3);
		text-align: left;
		cursor: pointer;
	}
	.liste button:hover {
		background: var(--surface-2);
	}

	.tipp {
		margin: var(--sp-4) 0 0;
		padding-top: var(--sp-4);
		border-top: 1px solid var(--edge-soft);
		font-size: var(--fs-xs);
		color: var(--ink-3);
	}
</style>
