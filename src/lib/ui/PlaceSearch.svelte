<script lang="ts">
	/**
	 * Ortssuche über der Karte.
	 *
	 * Bedienung mit der Tastatur ist hier kein Zubehör: wer einen Ort sucht,
	 * tippt ohnehin — die Hand soll die Tastatur nicht verlassen müssen, um
	 * einen Treffer auszuwählen. Pfeiltasten, Eingabe, Escape.
	 *
	 * ARIA-Muster ist die Combobox: das Eingabefeld behält den Fokus, der
	 * hervorgehobene Treffer wird über aria-activedescendant angesagt.
	 */
	import Icon from './Icon.svelte';
	import IconButton from './IconButton.svelte';

	export interface Ort {
		id: string;
		name: string;
		detail: string;
		lon: number;
		lat: number;
		bbox?: [number, number, number, number];
	}

	interface Props {
		onSelect: (ort: Ort) => void;
		placeholder?: string;
	}

	let { onSelect, placeholder = 'Ort, Gipfel, Hütte, Bahnhof …' }: Props = $props();

	let feld: HTMLInputElement | undefined = $state();
	let text = $state('');
	let treffer = $state<Ort[]>([]);
	let offen = $state(false);
	let aktiv = $state(-1);
	let laeuft = $state(false);
	let fehler = $state<string | null>(null);

	let timer: ReturnType<typeof setTimeout> | undefined;
	/** Nur die jüngste Antwort zählt — langsame Anfragen dürfen keine
	 *  frischeren Treffer überschreiben. */
	let lauf = 0;

	function getippt(v: string) {
		text = v;
		fehler = null;
		clearTimeout(timer);

		if (v.trim().length < 2) {
			treffer = [];
			offen = false;
			return;
		}
		// Entprellt, weil jede Anfrage einen fremden Dienst kostet.
		timer = setTimeout(() => void suchen(v.trim()), 350);
	}

	async function suchen(q: string) {
		const meins = ++lauf;
		laeuft = true;
		try {
			const res = await fetch(`/api/suche?q=${encodeURIComponent(q)}`);
			const daten = await res.json();
			if (meins !== lauf) return;

			if (!res.ok) {
				fehler = daten.error ?? 'Ortssuche fehlgeschlagen';
				treffer = [];
			} else {
				treffer = daten.results;
				fehler = null;
			}
			aktiv = treffer.length > 0 ? 0 : -1;
			offen = true;
		} catch {
			if (meins === lauf) {
				fehler = 'Server nicht erreichbar';
				treffer = [];
				offen = true;
			}
		} finally {
			if (meins === lauf) laeuft = false;
		}
	}

	function waehlen(o: Ort) {
		onSelect(o);
		text = o.name;
		offen = false;
		aktiv = -1;
	}

	function leeren() {
		text = '';
		treffer = [];
		offen = false;
		fehler = null;
		feld?.focus();
	}

	function taste(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			if (offen) {
				offen = false;
				e.stopPropagation();
			} else leeren();
			return;
		}
		if (!offen || treffer.length === 0) return;

		if (e.key === 'ArrowDown') {
			e.preventDefault();
			aktiv = (aktiv + 1) % treffer.length;
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			aktiv = (aktiv - 1 + treffer.length) % treffer.length;
		} else if (e.key === 'Enter' && aktiv >= 0) {
			e.preventDefault();
			waehlen(treffer[aktiv]);
		}
	}
</script>

<div class="suche">
	<div class="feld">
		<Icon name="search" size={14} />
		<input
			bind:this={feld}
			type="text"
			role="combobox"
			aria-expanded={offen}
			aria-controls="ortsliste"
			aria-activedescendant={aktiv >= 0 ? `ort-${aktiv}` : undefined}
			aria-label="Ort suchen"
			autocomplete="off"
			spellcheck="false"
			{placeholder}
			value={text}
			oninput={(e) => getippt(e.currentTarget.value)}
			onkeydown={taste}
			onfocus={() => treffer.length > 0 && (offen = true)}
		/>
		{#if laeuft}
			<Icon name="loader" size={14} class="spin" />
		{:else if text}
			<IconButton icon="close" label="Suche leeren" size="sm" onclick={leeren} />
		{/if}
	</div>

	{#if offen}
		<ul class="liste" id="ortsliste" role="listbox" aria-label="Treffer">
			{#if fehler}
				<li class="hinweis" role="presentation">{fehler}</li>
			{:else if treffer.length === 0}
				<li class="hinweis" role="presentation">Nichts gefunden.</li>
			{:else}
				{#each treffer as o, i (o.id)}
					<li
						id="ort-{i}"
						role="option"
						aria-selected={i === aktiv}
						class:aktiv={i === aktiv}
					>
						<!-- onmousedown statt onclick: click käme erst nach dem
						     Fokusverlust, und der schließt die Liste. -->
						<button type="button" onmousedown={() => waehlen(o)} tabindex="-1">
							<Icon name="waypoint" size={14} />
							<span class="namen">
								<b>{o.name}</b>
								{#if o.detail}<span class="detail">{o.detail}</span>{/if}
							</span>
						</button>
					</li>
				{/each}
			{/if}
		</ul>
	{/if}
</div>

<svelte:window onclick={(e) => !(e.target as Element)?.closest('.suche') && (offen = false)} />

<style>
	.suche {
		position: relative;
	}

	.feld {
		display: flex;
		align-items: center;
		gap: var(--sp-3);
		padding: 0 var(--sp-3) 0 var(--sp-4);
		background: var(--surface);
		border: 1px solid var(--edge);
		border-radius: var(--r-sm);
		box-shadow: var(--el-2);
		color: var(--ink-3);
	}

	.feld:focus-within {
		border-color: var(--ink-3);
	}

	input {
		flex: 1;
		min-width: 0;
		padding: var(--sp-4) 0;
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
		position: absolute;
		top: calc(100% + var(--sp-2));
		left: 0;
		right: 0;
		z-index: var(--z-popover);
		list-style: none;
		margin: 0;
		padding: var(--sp-2);
		max-height: 22rem;
		overflow-y: auto;
		background: var(--surface);
		border: 1px solid var(--edge);
		border-radius: var(--r-sm);
		box-shadow: var(--el-3);
	}

	.liste button {
		display: flex;
		align-items: flex-start;
		gap: var(--sp-3);
		width: 100%;
		padding: var(--sp-3) var(--sp-4);
		border: 0;
		border-radius: var(--r-xs);
		background: transparent;
		color: var(--ink-3);
		text-align: left;
		cursor: pointer;
	}

	.aktiv button,
	.liste button:hover {
		background: var(--surface-2);
	}

	.namen {
		min-width: 0;
	}

	b {
		display: block;
		color: var(--ink);
		font-size: var(--fs-sm);
		font-weight: 600;
	}

	.detail {
		display: block;
		font-size: var(--fs-xs);
		color: var(--ink-3);
	}

	.hinweis {
		padding: var(--sp-4);
		font-size: var(--fs-sm);
		color: var(--ink-3);
	}
</style>
