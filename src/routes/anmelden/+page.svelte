<script lang="ts">
	/**
	 * Die einzige Seite ohne Anmeldung — und die erste, die je ein fremder
	 * Besucher sieht. Deshalb keine Karte, keine Werkzeuge, kein Beiwerk:
	 * ein Feldpaar, ein Knopf.
	 */
	import { enhance } from '$app/forms';
	import Alert from '$lib/ui/Alert.svelte';
	import Button from '$lib/ui/Button.svelte';
	import Icon from '$lib/ui/Icon.svelte';
	import LegalLinks from '$lib/ui/LegalLinks.svelte';
	import ThemeToggle from '$lib/ui/ThemeToggle.svelte';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let laeuft = $state(false);
</script>

<svelte:head><title>Anmelden — Wandervogel</title></svelte:head>

<main>
	<div class="ecke"><ThemeToggle size="sm" /></div>

	<form
		method="POST"
		use:enhance={() => {
			laeuft = true;
			return async ({ update }) => {
				await update();
				laeuft = false;
			};
		}}
	>
		<h1><Icon name="route" size={20} /> Wandervogel</h1>
		<p class="unter">Touren planen und unterwegs finden.</p>

		{#if form?.fehler}
			<Alert tone="bad">{form.fehler}</Alert>
		{/if}

		<label>
			<span>Benutzername</span>
			<!-- autofocus ist hier richtig: die Seite hat genau eine Aufgabe,
			     und der Fokus springt niemandem etwas weg. -->
			<!-- svelte-ignore a11y_autofocus -->
			<input
				name="username"
				autocomplete="username"
				autocapitalize="none"
				spellcheck="false"
				autofocus
				required
				value={form?.username ?? ''}
			/>
		</label>

		<label>
			<span>Passwort</span>
			<input name="passwort" type="password" autocomplete="current-password" required />
		</label>

		<input type="hidden" name="weiter" value={data.weiter} />

		<Button type="submit" variant="primary" icon="check" loading={laeuft} disabled={laeuft}>
			{laeuft ? 'Wird geprüft …' : 'Anmelden'}
		</Button>
	</form>

	<!-- Unter dem Formular und nicht in der Ecke: auf der Anmeldeseite ist
	     das Rechtliche der einzige weitere Inhalt, den es zu erreichen gibt. -->
	<footer><LegalLinks size="xs" /></footer>
</main>

<style>
	main {
		min-height: 100dvh;
		display: grid;
		place-items: center;
		align-content: center;
		gap: var(--sp-4);
		padding: var(--sp-5);
		background: var(--paper);
	}

	.ecke {
		position: fixed;
		top: var(--sp-4);
		right: var(--sp-4);
	}

	form {
		width: min(22rem, 100%);
		display: flex;
		flex-direction: column;
		gap: var(--sp-4);
		padding: var(--sp-6);
		border: 1px solid var(--edge-soft);
		border-radius: var(--r-md);
		background: var(--surface);
		box-shadow: var(--el-1);
	}

	footer {
		display: flex;
		justify-content: center;
	}

	h1 {
		display: flex;
		align-items: center;
		gap: var(--sp-3);
		margin: 0;
		font-size: var(--fs-lg);
		font-weight: 600;
	}

	.unter {
		margin: calc(-1 * var(--sp-2)) 0 var(--sp-2);
		font-size: var(--fs-sm);
		color: var(--ink-3);
	}

	label {
		display: flex;
		flex-direction: column;
		gap: var(--sp-2);
		font-size: var(--fs-sm);
		color: var(--ink-2);
	}

	input {
		padding: var(--sp-3);
		border: 1px solid var(--edge);
		border-radius: var(--r-sm);
		background: var(--paper-2);
		color: var(--ink);
		font: inherit;
	}

	input:focus-visible {
		outline: var(--focus-w) solid var(--focus);
		outline-offset: 1px;
		border-color: var(--edge);
	}
</style>
