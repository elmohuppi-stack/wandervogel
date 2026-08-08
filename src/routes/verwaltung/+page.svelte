<script lang="ts">
	/**
	 * Nutzerverwaltung — eine Liste, ein Formular zum Anlegen.
	 *
	 * Jede Zeile ist ein eigenes Formular statt einer Bearbeitungsmaske in
	 * einem Dialog: die Angaben sind vier, sie passen in eine Zeile, und ein
	 * Dialog wäre ein Klick mehr für jede Änderung. Anforderungen §7,
	 * „keine Menüs für Standardaktionen".
	 */
	import { enhance } from '$app/forms';
	import Alert from '$lib/ui/Alert.svelte';
	import Button from '$lib/ui/Button.svelte';
	import Icon from '$lib/ui/Icon.svelte';
	import PasswordField from '$lib/ui/PasswordField.svelte';
	import Panel from '$lib/ui/Panel.svelte';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	/** Welche Zeile gerade ihr Passwort ändert. */
	let pwOffen = $state<string | null>(null);

	const fehlerVon = (schluessel: string) =>
		form && 'fehler' in form && form.form === schluessel ? form.fehler : null;
</script>

<svelte:head><title>Nutzer — Wandervogel</title></svelte:head>

<main>
	<h1>Nutzer</h1>

	{#if form && 'ok' in form && form.ok}
		<Alert tone="ok">{form.ok}</Alert>
	{/if}

	<Panel>
		<h2><Icon name="list" size={14} /> Vorhandene Nutzer <span class="zahl">{data.nutzer.length}</span></h2>

		<ul class="liste">
			{#each data.nutzer as n (n.id)}
				<li class:inaktiv={!n.active}>
					<form method="POST" action="?/aendern" use:enhance>
						<input type="hidden" name="id" value={n.id} />

						<div class="kennung">
							<b>{n.username}</b>
							{#if n.id === data.selbst}<span class="du">du</span>{/if}
							<span class="touren">{n.tourCount} {n.tourCount === 1 ? 'Tour' : 'Touren'}</span>
						</div>

						<label class="feld">
							<span>Anzeigename</span>
							<input name="displayName" value={n.displayName} required />
						</label>

						<label class="feld schmal">
							<span>Rolle</span>
							<select name="role" value={n.role}>
								<option value="user">Nutzer</option>
								<option value="admin">Admin</option>
							</select>
						</label>

						<label class="schalter">
							<input type="checkbox" name="active" checked={n.active} />
							<span>aktiv</span>
						</label>

						<Button type="submit" variant="quiet" size="sm" icon="save">Speichern</Button>
						<Button
							variant="ghost"
							size="sm"
							icon="pencil"
							onclick={() => (pwOffen = pwOffen === n.id ? null : n.id)}
						>
							Passwort
						</Button>
					</form>

					{#if fehlerVon(n.id)}
						<Alert tone="bad">{fehlerVon(n.id)}</Alert>
					{/if}

					{#if pwOffen === n.id}
						<form method="POST" action="?/passwort" class="pw" use:enhance={() => async ({ update }) => {
							await update();
							pwOffen = null;
						}}>
							<input type="hidden" name="id" value={n.id} />
							<div class="feld">
								<PasswordField
									name="passwort"
									label="Neues Passwort für {n.displayName}"
									autocomplete="new-password"
									required
								/>
							</div>
							<Button type="submit" variant="primary" size="sm" icon="check">Setzen</Button>
							<Button variant="ghost" size="sm" icon="close" onclick={() => (pwOffen = null)}>
								Abbrechen
							</Button>
						</form>
					{/if}

					{#if fehlerVon(`pw-${n.id}`)}
						<Alert tone="bad">{fehlerVon(`pw-${n.id}`)}</Alert>
					{/if}
				</li>
			{/each}
		</ul>
	</Panel>

	<Panel>
		<h2><Icon name="plus" size={14} /> Neuen Nutzer anlegen</h2>
		<p class="hinweis">
			Es gibt keine Selbstregistrierung — Zugänge entstehen ausschließlich hier.
		</p>

		{#if fehlerVon('anlegen')}
			<Alert tone="bad">{fehlerVon('anlegen')}</Alert>
		{/if}

		<form method="POST" action="?/anlegen" class="neu" use:enhance>
			<label class="feld">
				<span>Benutzername</span>
				<input name="username" autocapitalize="none" spellcheck="false" required />
			</label>
			<label class="feld">
				<span>Anzeigename</span>
				<input name="displayName" required />
			</label>
			<div class="feld">
				<PasswordField name="passwort" label="Passwort" autocomplete="new-password" required />
			</div>
			<label class="feld schmal">
				<span>Rolle</span>
				<select name="role">
					<option value="user">Nutzer</option>
					<option value="admin">Admin</option>
				</select>
			</label>
			<Button type="submit" variant="primary" size="sm" icon="plus">Anlegen</Button>
		</form>
	</Panel>

</main>

<style>
	h1 {
		margin: 0 0 var(--sp-2);
		font-size: var(--fs-lg);
		font-weight: 600;
	}

	main {
		display: flex;
		flex-direction: column;
		gap: var(--sp-5);
		max-width: 60rem;
		height: 100%;
		margin: 0 auto;
		padding: var(--sp-5);
		overflow-y: auto;
	}

	h2 {
		display: flex;
		align-items: center;
		gap: var(--sp-2);
		margin: 0 0 var(--sp-4);
		font-size: var(--fs-sm);
		font-weight: 600;
		color: var(--ink-2);
	}

	.zahl {
		color: var(--ink-3);
		font-weight: 400;
	}

	.hinweis {
		margin: calc(-1 * var(--sp-3)) 0 var(--sp-4);
		font-size: var(--fs-sm);
		color: var(--ink-3);
	}

	.liste {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: var(--sp-3);
	}

	.liste li {
		padding: var(--sp-4);
		border: 1px solid var(--edge-soft);
		border-radius: var(--r-sm);
	}

	/* Deaktiviert wird gedämpft, nicht versteckt: die Zeile muss auffindbar
	   bleiben, sonst kann man sie nicht wieder einschalten. */
	.liste li.inaktiv {
		opacity: 0.6;
		background: var(--paper-2);
	}

	form {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		gap: var(--sp-3);
	}

	.kennung {
		display: flex;
		align-items: baseline;
		gap: var(--sp-2);
		min-width: 11rem;
		font-size: var(--fs-sm);
	}

	.du {
		padding: 0 var(--sp-2);
		border-radius: var(--r-pill);
		background: var(--paper-2);
		border: 1px solid var(--edge-soft);
		font-size: var(--fs-xs);
		color: var(--ink-3);
	}

	.touren {
		font-size: var(--fs-xs);
		color: var(--ink-3);
	}

	.feld {
		display: flex;
		flex-direction: column;
		gap: var(--sp-2);
		flex: 1 1 10rem;
		font-size: var(--fs-xs);
		color: var(--ink-3);
	}

	.feld.schmal {
		flex: 0 0 7rem;
	}

	.feld input,
	.feld select {
		padding: var(--sp-2) var(--sp-3);
		border: 1px solid var(--edge);
		border-radius: var(--r-sm);
		background: var(--surface);
		color: var(--ink);
		font: inherit;
		font-size: var(--fs-sm);
	}

	.feld input:focus-visible,
	.feld select:focus-visible {
		outline: var(--focus-w) solid var(--focus);
		outline-offset: 1px;
	}

	.schalter {
		display: flex;
		align-items: center;
		gap: var(--sp-2);
		padding-bottom: var(--sp-2);
		font-size: var(--fs-sm);
		color: var(--ink-2);
	}

	.pw {
		margin-top: var(--sp-3);
		padding-top: var(--sp-3);
		border-top: 1px dashed var(--edge-soft);
	}

	.neu {
		align-items: flex-end;
	}
</style>
