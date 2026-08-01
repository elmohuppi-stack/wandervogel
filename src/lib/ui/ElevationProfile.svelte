<script lang="ts">
	/**
	 * Höhenprofil, einklappbar.
	 *
	 * Eingeklappt bleiben Höhenbereich und eine Sparkline stehen — die
	 * Angabe geht also nicht verloren, nur die Ablesbarkeit. Die Karte
	 * gewinnt dafür rund 100 Pixel.
	 *
	 * Bewusst kein Höhen-Übergang beim Auf- und Zuklappen: die Karte
	 * darunter ist eine WebGL-Fläche, die während einer Höhenanimation
	 * dutzende Male neu vermessen würde. Das ruckelt sichtbar.
	 */
	import { activity, type ActivityType } from '$lib/geo/activity';
	import * as fmt from '$lib/format';
	import type { RouteResult } from '$lib/tour/types';
	import Icon from './Icon.svelte';

	interface Props {
		route: RouteResult | null;
		activityType: ActivityType;
		collapsed: boolean;
		/** Position unter dem Zeiger (0–1) oder null. */
		hoverAt: number | null;
	}

	let {
		route,
		activityType,
		collapsed = $bindable(),
		hoverAt = $bindable()
	}: Props = $props();

	let wrap: HTMLDivElement | undefined = $state();

	const VB_W = 1000;
	const VB_H = 100;

	/** Höhenwerte gleichmäßig auf die Breite verteilt. */
	const elevations = $derived(route?.coordinates.map((c) => c[2]) ?? []);
	const hasProfile = $derived(elevations.length > 1);

	const lo = $derived(hasProfile ? Math.min(...elevations) : 0);
	const hi = $derived(hasProfile ? Math.max(...elevations) : 0);
	const span = $derived(hi - lo || 1);

	function pathFor(w: number, h: number, pad: number): string {
		let d = '';
		const n = elevations.length - 1;
		for (let i = 0; i <= n; i++) {
			const x = (i / n) * w;
			const y = pad + (1 - (elevations[i] - lo) / span) * (h - pad * 2);
			d += (i ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1);
		}
		return d;
	}

	const linePath = $derived(hasProfile ? pathFor(VB_W, VB_H, 2) : '');
	const areaPath = $derived(hasProfile ? `${linePath}L${VB_W} ${VB_H}L0 ${VB_H}Z` : '');
	const sparkPath = $derived(hasProfile ? pathFor(200, 30, 2) : '');

	const hoverIndex = $derived(
		hoverAt == null || !hasProfile ? null : Math.round(hoverAt * (elevations.length - 1))
	);

	const hoverEle = $derived(hoverIndex == null ? null : elevations[hoverIndex]);
	const hoverKm = $derived(
		hoverAt == null || !route ? null : fmt.km(route.distanceM * hoverAt)
	);

	const hoverY = $derived(
		hoverIndex == null ? 0 : 2 + (1 - (elevations[hoverIndex] - lo) / span) * (VB_H - 4)
	);

	function track(clientX: number) {
		if (collapsed || !wrap || !hasProfile) return;
		const r = wrap.getBoundingClientRect();
		hoverAt = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
	}

	function toggle() {
		collapsed = !collapsed;
		// Eingeklappt gibt es kein Überfahren — sonst bliebe der Marker
		// auf der Karte stehen.
		if (collapsed) hoverAt = null;
	}
</script>

<div class="profile" data-collapsed={collapsed} data-plot={!collapsed && hasProfile}>
	<div class="head">
		<Icon name="profile" size={14} class="titel-icon" />
		<span class="label">Höhenprofil</span>

		{#if hasProfile}
			<b class="num range">{fmt.hm(lo)}–{fmt.hm(hi)} m</b>
			<span class="spark" aria-hidden="true">
				<svg viewBox="0 0 200 30" preserveAspectRatio="none">
					<path d={`${sparkPath}L200 30L0 30Z`} class="spark-fill" />
					<path d={sparkPath} class="spark-line" />
				</svg>
			</span>
		{:else}
			<span class="empty">Entsteht mit der Route</span>
		{/if}

		{#if hoverKm && hoverEle != null}
			<span class="num readout">{hoverKm} km · {fmt.hm(hoverEle)} m</span>
		{/if}

		<button
			type="button"
			class="toggle"
			aria-expanded={!collapsed}
			onclick={toggle}
			disabled={!hasProfile}
		>
			<Icon name="chevron-down" size={12} class="caret" />
			{collapsed ? 'Profil zeigen' : 'Einklappen'}
		</button>
	</div>

	<!-- Ohne Route auch keine leere Zeichenfläche: 132 px Nichts unter der
	     Karte sind kein Profil, sondern verschenkter Platz. -->
	{#if !collapsed && hasProfile}
		<div
			class="plot"
			bind:this={wrap}
			role="img"
			aria-label={hasProfile
				? `Höhenprofil von ${fmt.hm(lo)} bis ${fmt.hm(hi)} Meter`
				: 'Kein Höhenprofil'}
			onmousemove={(e) => track(e.clientX)}
			onmouseleave={() => (hoverAt = null)}
			ontouchmove={(e) => {
				if (e.touches[0]) track(e.touches[0].clientX);
			}}
		>
			{#if hasProfile}
				<svg viewBox="0 0 {VB_W} {VB_H}" preserveAspectRatio="none">
					{#each [0.25, 0.5, 0.75] as f (f)}
						<line x1="0" y1={f * VB_H} x2={VB_W} y2={f * VB_H} class="grid" />
					{/each}
					<path d={areaPath} class="area" />
					<path d={linePath} class="line" />
					{#if hoverAt != null && hoverIndex != null}
						<line
							x1={hoverAt * VB_W}
							y1="0"
							x2={hoverAt * VB_W}
							y2={VB_H}
							class="cursor"
						/>
						<circle cx={hoverAt * VB_W} cy={hoverY} r="4" class="dot" />
					{/if}
				</svg>
			{/if}
		</div>
	{/if}
</div>

<style>
	/**
	 * Die Höhe hängt am Inhalt, nicht am Zustand.
	 *
	 * Vorher galt --profile-h immer, außer beim Einklappen. Ohne Route
	 * standen damit 132 px leere Zeichenfläche unter der Karte. Kein
	 * Übergang auf der Höhe: der WebGL-Kontext der Karte müsste bei jedem
	 * Zwischenschritt neu vermessen werden, das ruckelt sichtbar.
	 */
	.profile {
		display: flex;
		flex-direction: column;
		gap: var(--sp-2);
		height: auto;
		padding: var(--sp-3) var(--sp-5) var(--sp-4);
		border-top: 1px solid var(--edge-soft);
		background: var(--surface);
	}
	.profile[data-plot='true'] {
		height: var(--profile-h);
	}

	.head {
		display: flex;
		align-items: center;
		gap: var(--sp-5);
		font-size: var(--fs-xs);
		color: var(--ink-3);
	}

	.range {
		font-weight: 600;
		color: var(--ink);
		font-size: var(--fs-sm);
	}

	.empty {
		font-style: italic;
	}

	.readout {
		font-family: var(--mono);
		color: var(--ink-2);
	}

	.spark {
		display: none;
		flex: none;
		width: 116px;
		height: 17px;
	}
	.profile[data-collapsed='true'] .spark {
		display: block;
	}
	.spark svg {
		display: block;
		width: 100%;
		height: 100%;
	}
	.spark-fill {
		fill: var(--route);
		opacity: 0.16;
	}
	.spark-line {
		fill: none;
		stroke: var(--route);
		stroke-width: 1.4;
		vector-effect: non-scaling-stroke;
	}

	.toggle {
		margin-left: auto;
		flex: none;
		display: flex;
		align-items: center;
		gap: var(--sp-3);
		font-size: var(--fs-xs);
		font-weight: 550;
		padding: var(--sp-1) var(--sp-3);
		border: 1px solid transparent;
		border-radius: var(--r-xs);
		background: transparent;
		color: var(--ink-3);
		cursor: pointer;
	}
	.toggle:hover:not(:disabled) {
		color: var(--ink);
		border-color: var(--edge);
		background: var(--surface-2);
	}
	.toggle:disabled {
		opacity: 0.4;
		cursor: default;
	}
	.toggle :global(.caret) {
		transition: rotate var(--dur-2) var(--ease);
	}
	.profile[data-collapsed='true'] .toggle :global(.caret) {
		rotate: 180deg;
	}

	.plot {
		flex: 1;
		min-height: 0;
		cursor: crosshair;
	}
	.plot svg {
		display: block;
		width: 100%;
		height: 100%;
	}

	.grid {
		stroke: var(--edge-soft);
		stroke-width: 1;
	}
	.area {
		fill: var(--route);
		opacity: 0.14;
	}
	.line {
		fill: none;
		stroke: var(--route);
		stroke-width: 2;
		vector-effect: non-scaling-stroke;
	}
	.cursor {
		stroke: var(--ink-3);
		stroke-width: 1;
		vector-effect: non-scaling-stroke;
	}
	.dot {
		fill: var(--ink);
		stroke: var(--surface);
		stroke-width: 2;
	}
</style>
