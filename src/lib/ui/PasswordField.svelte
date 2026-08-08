<script lang="ts">
	/**
	 * Passwortfeld mit Sichtbarkeitsschalter.
	 *
	 * Ein Baustein und keine drei Einzelfälle: das Feld kommt an drei
	 * Stellen vor — Anmeldung, neuen Nutzer anlegen, Passwort zurücksetzen.
	 * Der Schalter dreimal einzeln zu bauen wäre genau die „Sammlung von
	 * Einzelfällen", vor der Abschnitt 7 warnt.
	 *
	 * Der Schalter ist ein Zusatz, keine Erleichterung für Angreifer: das
	 * Passwort steht ohnehin im Speicher der Seite. Was er verhindert, ist
	 * der häufigste echte Fehlversuch — ein Tippfehler in einem Feld, das
	 * nur Punkte zeigt.
	 */
	import Icon from './Icon.svelte';

	interface Props {
		name: string;
		label: string;
		value?: string;
		/** `current-password` beim Anmelden, `new-password` beim Setzen. */
		autocomplete?: 'current-password' | 'new-password';
		required?: boolean;
		autofocus?: boolean;
	}

	let {
		name,
		label,
		value = $bindable(''),
		autocomplete = 'current-password',
		required = false,
		autofocus = false
	}: Props = $props();

	let sichtbar = $state(false);
	let feld: HTMLInputElement | undefined = $state();

	function umschalten() {
		/*
		 * Position merken und zurücksetzen.
		 *
		 * Ein Wechsel des `type` setzt in Chrome und Safari den Cursor ans
		 * Ende. Wer mitten im Wort nachsieht, tippt danach an der falschen
		 * Stelle weiter — und sucht den Fehler im Passwort statt im Feld.
		 */
		const start = feld?.selectionStart ?? null;
		const ende = feld?.selectionEnd ?? null;
		sichtbar = !sichtbar;
		if (start !== null && ende !== null) {
			queueMicrotask(() => {
				feld?.focus();
				feld?.setSelectionRange(start, ende);
			});
		}
	}
</script>

<label>
	<span>{label}</span>
	<div class="feld" class:sichtbar>
		<!-- Kein `type={sichtbar ? …}`: Svelte lässt `type` an einem Element mit
		     `bind:value` nicht dynamisch binden, weil sich damit die Bedeutung
		     des Werts ändern kann. Zwei Zweige sind hier das ehrlichere Mittel. -->
		{#if sichtbar}
			<!-- svelte-ignore a11y_autofocus -->
			<input
				bind:this={feld}
				bind:value
				{name}
				type="text"
				{autocomplete}
				{required}
				{autofocus}
				autocapitalize="none"
				autocorrect="off"
				spellcheck="false"
			/>
		{:else}
			<!-- svelte-ignore a11y_autofocus -->
			<input
				bind:this={feld}
				bind:value
				{name}
				type="password"
				{autocomplete}
				{required}
				{autofocus}
			/>
		{/if}

		<button
			type="button"
			onclick={umschalten}
			aria-pressed={sichtbar}
			aria-label={sichtbar ? 'Passwort verbergen' : 'Passwort anzeigen'}
			title={sichtbar ? 'Passwort verbergen' : 'Passwort anzeigen'}
		>
			<Icon name={sichtbar ? 'eye-off' : 'eye'} size={15} />
		</button>
	</div>
</label>

<style>
	label {
		display: flex;
		flex-direction: column;
		gap: var(--sp-2);
	}

	.feld {
		display: flex;
		align-items: stretch;
		border: 1px solid var(--edge);
		border-radius: var(--r-sm);
		background: var(--paper-2);
		overflow: hidden;
	}

	/* Der Fokusring gehört der Hülle, nicht dem Feld darin — sonst umrandet
	   er nur die halbe Zeile und der Schalter steht sichtbar daneben. */
	.feld:focus-within {
		outline: var(--focus-w) solid var(--focus);
		outline-offset: 1px;
	}

	input {
		flex: 1 1 auto;
		min-width: 0;
		padding: var(--sp-3);
		border: none;
		background: none;
		color: var(--ink);
		font: inherit;
	}

	input:focus {
		outline: none;
	}

	/* Im Klartext monospaced: so lassen sich l, 1 und I unterscheiden — der
	   Grund, aus dem man überhaupt nachsieht. */
	.feld.sichtbar input {
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
	}

	button {
		display: flex;
		align-items: center;
		padding: 0 var(--sp-3);
		border: none;
		background: none;
		color: var(--ink-3);
		cursor: pointer;
	}

	button:hover {
		color: var(--ink);
	}

	button:focus-visible {
		outline: var(--focus-w) solid var(--focus);
		outline-offset: -2px;
		border-radius: var(--r-sm);
	}
</style>
