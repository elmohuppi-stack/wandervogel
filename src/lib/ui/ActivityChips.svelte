<script lang="ts">
	/**
	 * Filter nach Aktivitätsart.
	 *
	 * Aus ACTIVITY_TYPES erzeugt, nie aufgezählt — eine dritte Art erscheint
	 * hier von selbst. `allowAll` verzweigt über die Betriebsart der
	 * Oberfläche, nicht über die Aktivitätsart; die Regel bleibt gewahrt.
	 */
	import { ACTIVITY_TYPES, activity, type ActivityType } from '$lib/geo/activity';
	import Chip from './Chip.svelte';

	interface Props {
		value: ActivityType | null;
		onselect: (t: ActivityType | null) => void;
		/** Ein führendes „Alle" für Filterlisten. */
		allowAll?: boolean;
	}

	let { value, onselect, allowAll = false }: Props = $props();
</script>

<div class="chips">
	{#if allowAll}
		<Chip pressed={value === null} onclick={() => onselect(null)}>Alle</Chip>
	{/if}
	{#each ACTIVITY_TYPES as t (t)}
		{@const a = activity(t)}
		<Chip
			pressed={value === t}
			icon={a.icon}
			colorVar={a.colorVar}
			onclick={() => onselect(t)}>{a.label}</Chip
		>
	{/each}
</div>

<style>
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: var(--sp-3);
	}
</style>
