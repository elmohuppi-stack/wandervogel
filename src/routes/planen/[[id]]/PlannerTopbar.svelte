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
	import SegmentedControl, { type Segment } from '$lib/ui/SegmentedControl.svelte';
	import ThemeToggle from '$lib/ui/ThemeToggle.svelte';

	interface Props {
		name: string;
		activityType: ActivityType;
		routing: boolean;
		saving: boolean;
		/** Es gibt ungespeicherte Änderungen. */
		dirty: boolean;
		/** Ohne Route gibt es nichts zu speichern. */
		canSave: boolean;
		onSave: () => void;
	}

	let {
		name = $bindable(),
		activityType = $bindable(),
		routing,
		saving,
		dirty,
		canSave,
		onSave
	}: Props = $props();

	// Drei Zustände, drei Beschriftungen. „Gespeichert" bleibt stehen statt
	// zu verschwinden — ein Knopf, der wegspringt, lässt zweifeln, ob es
	// geklappt hat.
	const beschriftung = $derived(saving ? 'Speichert …' : dirty ? 'Speichern' : 'Gespeichert');

	// Aus der Naht erzeugt, nicht aufgezählt: eine dritte Aktivitätsart
	// erscheint hier von selbst.
	const arten: Segment[] = ACTIVITY_TYPES.map((t) => {
		const a = activity(t);
		return { value: t, label: a.label, icon: a.icon, colorVar: a.colorVar };
	});
</script>

<header class="topbar">
	<Button variant="ghost" size="sm" icon="chevron-left" href="/">Touren</Button>

	<input class="tour-name" bind:value={name} aria-label="Name der Tour" spellcheck="false" />

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

	<ThemeToggle size="sm" />

	<Button
		variant={dirty ? 'primary' : 'quiet'}
		size="sm"
		icon={dirty || saving ? 'save' : 'check'}
		loading={saving}
		disabled={!canSave || !dirty}
		title={canSave ? 'Tour speichern (Strg+S)' : 'Erst eine Route berechnen lassen'}
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
		min-width: 8rem;
		max-width: 22rem;
		flex: 0 1 auto;
		padding: var(--sp-2) var(--sp-3);
		border: 1px solid transparent;
		border-radius: var(--r-sm);
		background: transparent;
		color: var(--ink);
		font: inherit;
		font-weight: 600;
	}
	.tour-name:hover {
		border-color: var(--edge);
	}
	.tour-name:focus {
		border-color: var(--edge);
		background: var(--paper-2);
		outline: none;
	}
	.tour-name:focus-visible {
		outline: var(--focus-w) solid var(--focus);
		outline-offset: 1px;
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
