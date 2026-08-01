<script lang="ts">
	/**
	 * Kennzahlen in zwei Stufen: die betonten groß, der Rest im Raster.
	 *
	 * Welche betont sind, steht in der Aktivitätsdefinition — beim Wandern
	 * entscheidet der Aufstieg über den Tag, auf dem Rad die Zeit. Diese
	 * Komponente sortiert nur, sie weiß nichts über Aktivitätsarten.
	 *
	 * Liegt in $lib/ui und nicht bei der Planungsansicht, weil die
	 * Feldansicht dieselbe Darstellung braucht.
	 */
	import type { Metric } from '$lib/geo/activity';
	import MetricTile from './MetricTile.svelte';

	interface Props {
		metrics: Metric[];
	}

	let { metrics }: Props = $props();

	const gross = $derived(metrics.filter((m) => m.emphasis));
	const klein = $derived(metrics.filter((m) => !m.emphasis));
</script>

{#if gross.length > 0}
	<div class="gross">
		{#each gross as m (m.label)}
			<MetricTile
				icon={m.icon}
				iconRotate={m.iconRotate}
				label={m.label}
				value={m.value}
				unit={m.unit}
				size="lg"
			/>
		{/each}
	</div>
{/if}

{#if klein.length > 0}
	<div class="klein">
		{#each klein as m (m.label)}
			<MetricTile
				icon={m.icon}
				iconRotate={m.iconRotate}
				label={m.label}
				value={m.value}
				unit={m.unit}
			/>
		{/each}
	</div>
{/if}

<style>
	.gross {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--sp-5);
	}

	.klein {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--sp-4) var(--sp-5);
	}

	.gross + .klein {
		margin-top: var(--sp-5);
		padding-top: var(--sp-5);
		border-top: 1px solid var(--edge-soft);
	}
</style>
