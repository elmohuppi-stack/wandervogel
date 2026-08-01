<script lang="ts">
	/**
	 * Musterseite: alle Tokens und alle Glyphen auf einem Blatt.
	 *
	 * Zweck ist das Vergleichen. Ein Icon, das aus der Reihe fällt, sieht man
	 * nur neben den anderen; ein Farbpaar, das im Dunkelmodus kippt, nur wenn
	 * man umschaltet, ohne die Seite zu wechseln.
	 */
	import Alert from '$lib/ui/Alert.svelte';
	import Button from '$lib/ui/Button.svelte';
	import Chip from '$lib/ui/Chip.svelte';
	import EmptyState from '$lib/ui/EmptyState.svelte';
	import Icon from '$lib/ui/Icon.svelte';
	import IconButton from '$lib/ui/IconButton.svelte';
	import MetricTile from '$lib/ui/MetricTile.svelte';
	import Panel from '$lib/ui/Panel.svelte';
	import SegmentedControl from '$lib/ui/SegmentedControl.svelte';
	import ThemeToggle from '$lib/ui/ThemeToggle.svelte';
	import { ICON_NAMES } from '$lib/ui/icons';
	import { theme, type ThemeChoice } from '$lib/ui/theme.svelte';

	let art = $state('hike');
	let filter = $state('alle');

	const FARBEN = [
		['--paper', 'Hintergrund der App'],
		['--paper-2', 'Kartenfläche, ruhige Zonen'],
		['--surface', 'Karten, Panels, Dialoge'],
		['--surface-2', 'gefüllte Knöpfe, Eingaben'],
		['--edge', 'sichtbare Kante'],
		['--edge-soft', 'Trennlinie innerhalb einer Fläche'],
		['--ink', 'Text'],
		['--ink-2', 'Nebentext'],
		['--ink-3', 'Beschriftung, Platzhalter'],
		['--route-hike', 'Wandern — Topo-Konvention rot'],
		['--route-bike', 'Radfahren — Topo-Konvention blau'],
		['--on-route', 'was auf einer Routenfarbe liegt'],
		['--focus', 'Fokusring — nie eine Routenfarbe'],
		['--contour', 'Höhenlinie'],
		['--contour-index', 'betonte Höhenlinie, Beschriftung'],
		['--water', 'Gewässer'],
		['--wood', 'Wald'],
		['--hs-shadow', 'Schummerung, Schatten'],
		['--hs-highlight', 'Schummerung, Licht'],
		['--route-casing', 'Fassung unter der Route'],
		['--ok', 'auf Route'],
		['--warn', 'Achtung'],
		['--bad', 'abseits, Fehler']
	] as const;

	const ABSTAENDE = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
	const RADIEN = ['xs', 'sm', 'md', 'lg', 'pill'];
	const SCHRIFT = ['xs', 'sm', 'base', 'lg', 'xl', '2xl'];
	const MODI: { v: ThemeChoice; t: string }[] = [
		{ v: 'light', t: 'Hell' },
		{ v: 'dark', t: 'Dunkel' },
		{ v: 'system', t: 'System' }
	];
</script>

<svelte:head><title>Stil — Wandervogel</title></svelte:head>

<div class="page">
	<header>
		<h1>Stil</h1>
		<div class="modi">
			{#each MODI as m (m.v)}
				<button
					type="button"
					aria-pressed={theme.choice === m.v}
					onclick={() => theme.set(m.v)}>{m.t}</button
				>
			{/each}
		</div>
	</header>

	<section>
		<h2 class="label">Knöpfe</h2>
		<div class="reihe">
			<Button variant="primary" icon="save">Speichern</Button>
			<Button variant="quiet" icon="crosshair">Auf Tour zentrieren</Button>
			<Button variant="ghost" icon="chevron-left" href="/planen">Touren</Button>
			<Button variant="danger" icon="trash">Tour löschen</Button>
			<Button variant="primary" loading>Speichert …</Button>
			<Button variant="quiet" disabled icon="save">Gesperrt</Button>
		</div>
		<div class="reihe">
			<Button variant="ghost" size="sm" icon="trash">alle löschen</Button>
			<Button variant="quiet" size="sm" iconEnd="chevron-down">Einklappen</Button>
			<IconButton icon="trash" label="Wegpunkt löschen" tone="danger" />
			<IconButton icon="close" label="Schließen" size="sm" />
			<IconButton icon="layers" label="Ebenen" pressed />
		</div>
		<div class="reihe schmal">
			<Button variant="quiet" wide icon="crosshair">Über die volle Breite</Button>
		</div>
	</section>

	<section>
		<h2 class="label">Umschalter und Chips</h2>
		<div class="reihe">
			<SegmentedControl
				bind:value={art}
				label="Aktivitätsart"
				options={[
					{ value: 'hike', label: 'Wandern', icon: 'hike', colorVar: '--route-hike' },
					{ value: 'bike', label: 'Rad', icon: 'bike', colorVar: '--route-bike' }
				]}
			/>
			<ThemeToggle />
			<ThemeToggle size="sm" labelsHidden={false} />
		</div>
		<div class="reihe">
			{#each [['alle', 'Alle'], ['hike', 'Wandern'], ['bike', 'Rad']] as [v, t] (v)}
				<Chip
					pressed={filter === v}
					colorVar={v === 'alle' ? undefined : `--route-${v}`}
					onclick={() => (filter = v)}>{t}</Chip
				>
			{/each}
			<Chip icon="hike" colorVar="--route-hike">Wandern</Chip>
		</div>
	</section>

	<section>
		<h2 class="label">Panel, Kennzahlen, Leerzustand, Hinweise</h2>
		<div class="zwei">
			<div class="rahmen">
				<Panel title="Kennzahlen" icon="gauge">
					<div class="gross">
						<MetricTile icon="ruler" label="Länge" value="14,2" unit="km" size="lg" />
						<MetricTile icon="clock" label="Dauer" value="4:25" unit="h" size="lg" />
					</div>
					<div class="klein">
						<MetricTile icon="ascent" label="Aufstieg" value="620" unit="hm" />
						<MetricTile icon="descent" label="Abstieg" value="580" unit="hm" />
						<MetricTile icon="mountain" label="Höchster Punkt" value="880" unit="m" />
						<MetricTile icon="mountain" iconRotate={180} label="Tiefster" value="310" unit="m" />
					</div>
				</Panel>
				<Panel title="Wegpunkte" icon="waypoint" count={0}>
					<EmptyState icon="waypoint" size="sm" title="Noch keine">
						In die Karte klicken setzt den ersten.
					</EmptyState>
				</Panel>
			</div>

			<div class="stapel">
				<div class="karte">
					<EmptyState icon="route" title="Los geht’s">
						In die Karte klicken setzt den Start. Ab dem zweiten Wegpunkt wird die Route
						entlang echter Wanderwege berechnet.
						{#snippet actions()}
							<Button variant="quiet" size="sm" icon="search">Ort suchen</Button>
						{/snippet}
					</EmptyState>
				</div>
				<Alert tone="info">Zwei Wegpunkte genügen für die erste Berechnung.</Alert>
				<Alert tone="ok">Auf Route.</Alert>
				<Alert tone="warn">120 m abseits der Route.</Alert>
				<Alert tone="bad" onDismiss={() => {}}>
					Routing-Dienst nicht erreichbar (17777). Läuft der Container?
				</Alert>
			</div>
		</div>
	</section>

	<section>
		<h2 class="label">Farben</h2>
		<ul class="farben">
			{#each FARBEN as [name, zweck] (name)}
				<li>
					<span class="chip" style="background: var({name})"></span>
					<code>{name}</code>
					<span class="zweck">{zweck}</span>
				</li>
			{/each}
		</ul>
	</section>

	<section>
		<h2 class="label">Symbole — {ICON_NAMES.length} Stück</h2>
		<p class="hinweis">
			Eine Strichstärke, ein Raster. Fällt eines optisch heraus, sieht man es hier.
		</p>
		<ul class="icons">
			{#each ICON_NAMES as name (name)}
				<li>
					<div class="groessen">
						<Icon {name} size={14} />
						<Icon {name} size={16} />
						<Icon {name} size={20} />
						<Icon {name} size={28} />
					</div>
					<code>{name}</code>
				</li>
			{/each}
		</ul>
	</section>

	<section>
		<h2 class="label">Abstände</h2>
		<ul class="balken">
			{#each ABSTAENDE as n (n)}
				<li><code>--sp-{n}</code><span style="width: var(--sp-{n})"></span></li>
			{/each}
		</ul>
	</section>

	<section>
		<h2 class="label">Radien und Ebenen</h2>
		<div class="kacheln">
			{#each RADIEN as r (r)}
				<div class="kachel" style="border-radius: var(--r-{r})"><code>--r-{r}</code></div>
			{/each}
		</div>
		<div class="kacheln">
			{#each ['1', '2', '3'] as e (e)}
				<div class="kachel" style="box-shadow: var(--el-{e})"><code>--el-{e}</code></div>
			{/each}
		</div>
	</section>

	<section>
		<h2 class="label">Schriftgrößen</h2>
		<ul class="schrift">
			{#each SCHRIFT as s (s)}
				<li style="font-size: var(--fs-{s})">14,2 km · 620 hm <code>--fs-{s}</code></li>
			{/each}
		</ul>
	</section>
</div>

<style>
	.page {
		max-width: 60rem;
		margin: 0 auto;
		padding: var(--sp-7) var(--sp-6) var(--sp-9);
	}

	header {
		display: flex;
		align-items: center;
		gap: var(--sp-6);
		margin-bottom: var(--sp-7);
	}

	h1 {
		font-size: var(--fs-xl);
		margin: 0;
		flex: 1;
	}

	.modi {
		display: flex;
		gap: 1px;
		background: var(--edge);
		border: 1px solid var(--edge);
		border-radius: var(--r-sm);
		overflow: hidden;
	}
	.modi button {
		border: 0;
		background: var(--surface);
		color: var(--ink-2);
		padding: var(--sp-3) var(--sp-5);
		font-size: var(--fs-sm);
		cursor: pointer;
	}
	.modi button[aria-pressed='true'] {
		background: var(--surface-2);
		color: var(--ink);
		font-weight: 600;
	}

	section {
		margin-bottom: var(--sp-8);
	}

	h2 {
		margin: 0 0 var(--sp-5);
	}

	.hinweis {
		margin: calc(-1 * var(--sp-3)) 0 var(--sp-5);
		font-size: var(--fs-sm);
		color: var(--ink-3);
	}

	ul {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	code {
		font-family: var(--mono);
		font-size: var(--fs-xs);
		color: var(--ink-3);
	}

	.reihe {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--sp-5);
		margin-bottom: var(--sp-5);
	}
	.reihe.schmal {
		max-width: 18rem;
	}

	.zwei {
		display: grid;
		grid-template-columns: var(--rail-w) 1fr;
		gap: var(--sp-6);
		align-items: start;
	}

	.rahmen {
		background: var(--surface);
		border: 1px solid var(--edge);
		border-radius: var(--r-md);
		overflow: hidden;
	}

	.stapel {
		display: flex;
		flex-direction: column;
		gap: var(--sp-5);
	}

	.karte {
		background: var(--surface);
		border: 1px solid var(--edge);
		border-radius: var(--r-sm);
		box-shadow: var(--el-2);
		padding: var(--sp-5) var(--sp-6);
	}

	.gross {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--sp-5);
		margin-bottom: var(--sp-5);
	}
	.klein {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--sp-4) var(--sp-5);
	}

	.farben li {
		display: flex;
		align-items: center;
		gap: var(--sp-4);
		padding: var(--sp-2) 0;
	}
	.chip {
		width: 28px;
		height: 20px;
		border: 1px solid var(--edge);
		border-radius: var(--r-xs);
		flex: none;
	}
	.farben code {
		width: 12rem;
	}
	.zweck {
		font-size: var(--fs-sm);
		color: var(--ink-2);
	}

	.icons {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(9rem, 1fr));
		gap: var(--sp-4);
	}
	.icons li {
		display: flex;
		flex-direction: column;
		gap: var(--sp-3);
		align-items: center;
		padding: var(--sp-5) var(--sp-3);
		background: var(--surface);
		border: 1px solid var(--edge-soft);
		border-radius: var(--r-md);
	}
	.groessen {
		display: flex;
		align-items: center;
		gap: var(--sp-4);
		color: var(--ink);
	}

	.balken li {
		display: flex;
		align-items: center;
		gap: var(--sp-4);
		padding: var(--sp-1) 0;
	}
	.balken code {
		width: 5rem;
	}
	.balken span {
		height: 12px;
		background: var(--route-hike);
		border-radius: var(--r-xs);
	}

	.kacheln {
		display: flex;
		gap: var(--sp-5);
		margin-bottom: var(--sp-5);
		flex-wrap: wrap;
	}
	.kachel {
		display: grid;
		place-items: center;
		width: 7rem;
		height: 4rem;
		background: var(--surface);
		border: 1px solid var(--edge-soft);
	}

	.schrift li {
		padding: var(--sp-2) 0;
		display: flex;
		align-items: baseline;
		gap: var(--sp-4);
	}
</style>
