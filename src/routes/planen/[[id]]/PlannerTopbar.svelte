<script lang="ts">
	/**
	 * Eine schmale Zeile statt einer Navigationsleiste.
	 *
	 * Das `W` im Kreis ist weg. Es war ein Textzeichen, das sich als Logo
	 * ausgab, sah auf jedem Betriebssystem anders aus und half niemandem.
	 * An seiner Stelle steht die nützlichere Tür: zurück zu den Touren.
	 */
	import { ACTIVITY_TYPES, activity, type ActivityType } from '$lib/geo/activity';
	import Button from '$lib/ui/Button.svelte';
	import Icon from '$lib/ui/Icon.svelte';
	import LegalLinks from '$lib/ui/LegalLinks.svelte';
	import SegmentedControl, { type Segment } from '$lib/ui/SegmentedControl.svelte';
	import ThemeToggle from '$lib/ui/ThemeToggle.svelte';

	interface Props {
		name: string;
		activityType: ActivityType;
		routing: boolean;
		saving: boolean;
		/** Es gibt ungespeicherte Änderungen. */
		dirty: boolean;
		/** Die Tour liegt schon in der Datenbank. */
		saved: boolean;
		/** Ohne Route gibt es nichts zu speichern. */
		canSave: boolean;
		/** Gäste dürfen planen, aber nicht behalten — der Knopf sagt das. */
		angemeldet: boolean;
		onSave: () => void;
	}

	let {
		name = $bindable(),
		activityType = $bindable(),
		routing,
		saving,
		dirty,
		saved,
		canSave,
		angemeldet,
		onSave
	}: Props = $props();

	// „Gespeichert" darf nur stehen, wenn wirklich schon gespeichert wurde.
	// Eine brandneue Tour ist nicht „nicht geändert", sie ist ungespeichert —
	// das zu verwechseln wäre eine Lüge im ruhigsten Moment der Oberfläche.
	const fertig = $derived(saved && !dirty);
	// Für Gäste heißt der Knopf, was er tut: er führt zur Anmeldung. „Speichern"
	// zu schreiben und dann wegzunavigieren wäre ein gebrochenes Versprechen.
	const beschriftung = $derived(
		!angemeldet
			? 'Anmelden zum Speichern'
			: saving
				? 'Speichert …'
				: fertig
					? 'Gespeichert'
					: 'Speichern'
	);

	// Aus der Naht erzeugt, nicht aufgezählt: eine dritte Aktivitätsart
	// erscheint hier von selbst.
	const arten: Segment[] = ACTIVITY_TYPES.map((t) => {
		const a = activity(t);
		return { value: t, label: a.label, icon: a.icon, colorVar: a.colorVar };
	});
</script>

<header class="topbar">
	<Button variant="ghost" size="sm" icon="chevron-left" href="/">Touren</Button>

	<!--
		Ein <label> und kein <div>: der Stift ist damit Teil der Trefffläche
		und fokussiert das Feld, statt nur danebenzustehen.

		Der Rahmen liegt im Ruhezustand an. Vorher war er durchsichtig und
		erschien erst beim Überfahren — das Feld sah aus wie eine
		Überschrift, und das Ergebnis stand im Archiv: zwei Touren namens
		„Neue Tour". Anforderungen §7: was man nur durch Ausprobieren
		entdeckt, findet niemand.
	-->
	<label class="tour-name">
		<input bind:value={name} aria-label="Name der Tour" spellcheck="false" />
		<Icon name="pencil" size={13} />
	</label>

	<SegmentedControl
		options={arten}
		bind:value={() => activityType, (v) => (activityType = v as ActivityType)}
		label="Aktivitätsart"
		size="sm"
	/>

	<span class="spacer"></span>

	<!-- aria-live: vorher meldete der Ladehinweis Screenreadern gar nichts. -->
	<span class="status" role="status" aria-live="polite">
		{#if routing}
			<Icon name="loader" size={14} class="spin" />
			Route wird berechnet …
		{/if}
	</span>

	<LegalLinks />
	<ThemeToggle size="sm" />

	<Button
		variant={fertig ? 'quiet' : 'primary'}
		size="sm"
		icon={!angemeldet ? 'check' : fertig && !saving ? 'check' : 'save'}
		loading={saving}
		disabled={!canSave || (angemeldet && fertig)}
		title={canSave
			? angemeldet
				? 'Tour speichern (Strg+S)'
				: 'Der Entwurf bleibt erhalten und lässt sich nach der Anmeldung speichern'
			: 'Erst eine Route berechnen lassen'}
		onclick={onSave}
	>
		{beschriftung}
	</Button>
</header>

<style>
	.topbar {
		grid-column: 1 / -1;
		display: flex;
		align-items: center;
		gap: var(--sp-4);
		padding: 0 var(--sp-4);
		background: var(--surface);
		border-bottom: 1px solid var(--edge);
		z-index: var(--z-topbar);
	}

	.tour-name {
		display: flex;
		align-items: center;
		gap: var(--sp-2);
		min-width: 8rem;
		max-width: 22rem;
		flex: 0 1 auto;
		padding: var(--sp-2) var(--sp-3);
		border: 1px solid var(--edge-soft);
		border-radius: var(--r-sm);
		background: transparent;
		color: var(--ink-3);
		cursor: text;
		transition: border-color var(--dur-1) var(--ease);
	}
	.tour-name:hover {
		border-color: var(--edge);
		color: var(--ink-2);
	}
	/* Der Rahmen gehört der Hülle, also muss auch der Fokusring dorthin. */
	.tour-name:focus-within {
		border-color: var(--edge);
		background: var(--paper-2);
		color: var(--ink-2);
		outline: var(--focus-w) solid var(--focus);
		outline-offset: 1px;
	}

	.tour-name input {
		min-width: 0;
		flex: 1 1 auto;
		border: none;
		background: none;
		padding: 0;
		color: var(--ink);
		font: inherit;
		font-weight: 600;
	}
	.tour-name input:focus {
		outline: none;
	}

	.spacer {
		flex: 1;
	}

	.status {
		display: flex;
		align-items: center;
		gap: var(--sp-3);
		font-size: var(--fs-sm);
		color: var(--ink-3);
		white-space: nowrap;
	}

	.status :global(.spin) {
		animation: spin 900ms linear infinite;
	}

	@keyframes spin {
		to {
			rotate: 360deg;
		}
	}
</style>
