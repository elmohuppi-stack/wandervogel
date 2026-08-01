<script lang="ts">
	/**
	 * Startbildschirm: das Archiv. Liste links, Karte rechts.
	 *
	 * Derselbe Aufbau, den Komoot für seine Entdeckenseite benutzt — gefüllt
	 * mit *eigenen* Touren. Die Karte bleibt damit die Hauptsache, und das
	 * Archiv ist nichts, was man erst suchen muss.
	 *
	 * Liste und Karte sind ein Bildschirm, nicht zwei: eine Karte überfahren
	 * hebt ihre Linie hervor, eine Linie überfahren holt ihre Karte in den
	 * Blick. Das ist das Detail, das aus zwei Flächen eine macht.
	 */
	import { untrack } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import type { ActivityType } from '$lib/geo/activity';
	import TourOverviewMap from '$lib/map/TourOverviewMap.svelte';
	import ActivityChips from '$lib/ui/ActivityChips.svelte';
	import Button from '$lib/ui/Button.svelte';
	import EmptyState from '$lib/ui/EmptyState.svelte';
	import Icon from '$lib/ui/Icon.svelte';
	import ThemeToggle from '$lib/ui/ThemeToggle.svelte';
	import TourCard from './TourCard.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let hoveredId = $state<string | null>(null);
	// Nur der Anfangswert: das Feld gehört danach dem Nutzer, und die
	// Adresse folgt ihm entprellt, nicht umgekehrt.
	let suche = $state(untrack(() => data.filter.q));
	let liste: HTMLDivElement | undefined = $state();

	const SORTIERUNGEN = [
		['updated', 'Zuletzt geändert'],
		['date', 'Nach Datum'],
		['name', 'Nach Name'],
		['distance', 'Längste zuerst'],
		['ascent', 'Meiste Höhenmeter'],
		['duration', 'Längste Dauer']
	] as const;

	const gefiltert = $derived(!!(data.filter.activityType || data.filter.q));

	/** Filter stehen in der Adresse: verlinkbar, und die Zurück-Taste stimmt. */
	function setze(änderungen: Record<string, string | null>) {
		const u = new URL(page.url);
		for (const [k, v] of Object.entries(änderungen)) {
			if (v) u.searchParams.set(k, v);
			else u.searchParams.delete(k);
		}
		void goto(u, { keepFocus: true, noScroll: true, replaceState: true });
	}

	let sucheTimer: ReturnType<typeof setTimeout> | undefined;
	function sucheGeändert(v: string) {
		suche = v;
		clearTimeout(sucheTimer);
		sucheTimer = setTimeout(() => setze({ q: v || null }), 300);
	}

	// Linie überfahren → die zugehörige Karte in den Blick holen.
	$effect(() => {
		if (!hoveredId || !liste) return;
		liste
			.querySelector(`[href="/planen/${hoveredId}"]`)
			?.scrollIntoView({ block: 'nearest' });
	});
</script>

<svelte:head><title>Touren — Wandervogel</title></svelte:head>

<div class="app">
	<header class="topbar">
		<Icon name="list" size={16} />
		<h1>Touren</h1>
		<span class="anzahl num">{data.tours.length}</span>
		<span class="spacer"></span>
		<ThemeToggle size="sm" />
		<Button variant="primary" size="sm" icon="plus" href="/planen">Neue Tour</Button>
	</header>

	<aside class="liste">
		<div class="filter">
			<label class="suchfeld">
				<Icon name="search" size={14} />
				<input
					type="search"
					placeholder="Name oder Notiz …"
					value={suche}
					oninput={(e) => sucheGeändert(e.currentTarget.value)}
					aria-label="Touren durchsuchen"
				/>
			</label>

			<ActivityChips
				value={data.filter.activityType}
				allowAll
				onselect={(t: ActivityType | null) => setze({ a: t })}
			/>

			<label class="sortierung">
				<span class="visually-hidden">Sortierung</span>
				<select
					value={data.filter.sort}
					onchange={(e) => setze({ sort: e.currentTarget.value })}
				>
					{#each SORTIERUNGEN as [v, t] (v)}
						<option value={v}>{t}</option>
					{/each}
				</select>
			</label>
		</div>

		<div class="karten" bind:this={liste}>
			{#if data.tours.length > 0}
				{#each data.tours as t (t.id)}
					<TourCard
						tour={t}
						active={hoveredId === t.id}
						onHover={(id: string | null) => (hoveredId = id)}
					/>
				{/each}
			{:else if gefiltert}
				<!-- Zwei verschiedene Leerzustände. Der eine ist eine
				     Einführung, der andere eine Sackgasse — sie zu
				     verwechseln ist der klassische Fehler. -->
				<EmptyState icon="search" title="Keine Tour passt zum Filter">
					{#snippet actions()}
						<Button
							variant="quiet"
							size="sm"
							icon="close"
							onclick={() => {
								suche = '';
								setze({ a: null, q: null });
							}}>Filter zurücksetzen</Button
						>
					{/snippet}
				</EmptyState>
			{:else}
				<EmptyState icon="route" title="Noch keine Tour gespeichert">
					Touren entstehen in der Planungsansicht: in die Karte klicken, Wegpunkte
					setzen, speichern.
					{#snippet actions()}
						<Button variant="primary" size="sm" icon="plus" href="/planen">
							Neue Tour planen
						</Button>
					{/snippet}
				</EmptyState>
			{/if}
		</div>
	</aside>

	<main class="karte">
		<TourOverviewMap
			tours={data.tours}
			bind:hoveredId
			onSelect={(id: string) => goto(`/planen/${id}`)}
		/>
	</main>
</div>

<style>
	.app {
		display: grid;
		grid-template-columns: var(--list-w) 1fr;
		grid-template-rows: var(--topbar-h) 1fr;
		height: 100dvh;
		overflow: hidden;
	}

	.topbar {
		grid-column: 1 / -1;
		display: flex;
		align-items: center;
		gap: var(--sp-4);
		padding: 0 var(--sp-5);
		background: var(--surface);
		border-bottom: 1px solid var(--edge);
		color: var(--ink-3);
		z-index: var(--z-topbar);
	}

	h1 {
		margin: 0;
		font-size: var(--fs-base);
		font-weight: 600;
		color: var(--ink);
	}

	.anzahl {
		font-size: var(--fs-xs);
	}

	.spacer {
		flex: 1;
	}

	.liste {
		display: flex;
		flex-direction: column;
		min-height: 0;
		background: var(--paper);
		border-right: 1px solid var(--edge);
	}

	.filter {
		display: grid;
		gap: var(--sp-4);
		padding: var(--sp-5);
		border-bottom: 1px solid var(--edge-soft);
		background: var(--surface);
	}

	.suchfeld {
		display: flex;
		align-items: center;
		gap: var(--sp-3);
		padding: 0 var(--sp-4);
		border: 1px solid var(--edge);
		border-radius: var(--r-sm);
		background: var(--paper-2);
		color: var(--ink-3);
	}
	.suchfeld input {
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

	.sortierung select {
		width: 100%;
		padding: var(--sp-3) var(--sp-4);
		border: 1px solid var(--edge);
		border-radius: var(--r-sm);
		background: var(--surface);
		color: var(--ink);
		font: inherit;
		font-size: var(--fs-sm);
	}

	.karten {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: var(--sp-4);
		padding: var(--sp-5);
	}

	.karte {
		position: relative;
		min-height: 0;
	}

	@media (max-width: 900px) {
		.app {
			grid-template-columns: 1fr;
			grid-template-rows: var(--topbar-h) minmax(0, 40vh) 1fr;
		}
		.liste {
			grid-row: 3;
			border-right: 0;
			border-top: 1px solid var(--edge);
		}
		.karte {
			grid-row: 2;
		}
	}
</style>
