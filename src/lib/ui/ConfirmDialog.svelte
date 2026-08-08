<script lang="ts">
	/**
	 * Rückfrage vor einer Handlung, die etwas kostet.
	 *
	 * Ersetzt `confirm()`. Der Browserdialog war der letzte Einzelfall in
	 * einer Oberfläche, die sonst aus einem Maßsatz kommt: er trägt die
	 * Adresse der Seite als Überschrift („Auf localhost:5180 wird Folgendes
	 * angezeigt"), sitzt oben am Fenster statt am Inhalt, kennt weder Symbol
	 * noch Farbe der Handlung — und sieht auf jedem Betriebssystem anders
	 * aus. Genau das, was Abschnitt 7 mit „ein System, keine Sammlung von
	 * Einzelfällen" meint.
	 *
	 * **Natives `<dialog>` und kein nachgebautes Overlay.** Es bringt
	 * Fokusfalle, Escape, Hintergrundsperre und `::backdrop` mit — alles
	 * Dinge, die ein selbst gebautes Modal typischerweise vergisst und die
	 * man erst mit der Tastatur bemerkt.
	 */
	import type { Snippet } from 'svelte';
	import Button from './Button.svelte';
	import Icon from './Icon.svelte';
	import type { IconName } from './icons';

	interface Props {
		open: boolean;
		title: string;
		icon?: IconName;
		/** Beschriftung des bestätigenden Knopfs — benennt die Handlung, nicht „OK". */
		confirmLabel: string;
		confirmIcon?: IconName;
		cancelLabel?: string;
		/** `danger` färbt den bestätigenden Knopf rot. Für Zerstörendes. */
		tone?: 'normal' | 'danger';
		onConfirm: () => void;
		onCancel?: () => void;
		children: Snippet;
	}

	let {
		open = $bindable(),
		title,
		icon,
		confirmLabel,
		confirmIcon,
		cancelLabel = 'Abbrechen',
		tone = 'normal',
		onConfirm,
		onCancel,
		children
	}: Props = $props();

	let dialog: HTMLDialogElement | undefined = $state();

	/*
	 * `showModal()` statt `open`-Attribut.
	 *
	 * Nur `showModal()` erzeugt die oberste Ebene mit Fokusfalle und
	 * Hintergrundsperre; ein gesetztes `open`-Attribut ergibt einen Dialog,
	 * durch den man hindurchtabben kann.
	 */
	$effect(() => {
		if (!dialog) return;
		if (open && !dialog.open) dialog.showModal();
		else if (!open && dialog.open) dialog.close();
	});

	function abbrechen() {
		open = false;
		onCancel?.();
	}

	function bestaetigen() {
		open = false;
		onConfirm();
	}
</script>

<!-- `cancel` deckt Escape ab; ohne das Abfangen schlösse der Dialog, ohne
     dass `open` es erfährt, und ließe sich danach nicht wieder öffnen. -->
<dialog
	bind:this={dialog}
	oncancel={(e) => {
		e.preventDefault();
		abbrechen();
	}}
	onclick={(e) => {
		// Klick auf den Hintergrund schließt. Das Ereignis trifft den Dialog
		// selbst nur dann — alles darin liegt im <form>.
		if (e.target === dialog) abbrechen();
	}}
>
	<form method="dialog" data-tone={tone}>
		<h2>
			{#if icon}<Icon name={icon} size={16} />{/if}
			{title}
		</h2>

		<div class="text">{@render children()}</div>

		<div class="knoepfe">
			<Button variant="ghost" size="sm" icon="close" onclick={abbrechen}>
				{cancelLabel}
			</Button>
			<Button
				variant={tone === 'danger' ? 'danger' : 'primary'}
				size="sm"
				icon={confirmIcon}
				onclick={bestaetigen}
			>
				{confirmLabel}
			</Button>
		</div>
	</form>
</dialog>

<style>
	dialog {
		padding: 0;
		border: 1px solid var(--edge);
		border-radius: var(--r-md);
		background: var(--surface);
		color: var(--ink);
		box-shadow: var(--el-2);
		max-width: min(28rem, calc(100vw - 2 * var(--sp-5)));
	}

	dialog::backdrop {
		/* Kein Token: `::backdrop` steht außerhalb des Dokumentbaums und erbt
		   deshalb keine eigenen Eigenschaften vom :root. */
		background: rgb(0 0 0 / 0.4);
	}

	form {
		display: flex;
		flex-direction: column;
		gap: var(--sp-4);
		padding: var(--sp-5);
	}

	h2 {
		display: flex;
		align-items: center;
		gap: var(--sp-3);
		margin: 0;
		font-size: var(--fs-base);
		font-weight: 600;
	}

	/* Das Symbol nimmt die Farbe der Handlung an — rot nur, wo etwas
	   verloren geht. `--bad` ist die semantische Farbe aus app.css; das
	   Topo-Rot der Wanderrouten wäre hier falsch, es bedeutet Aktivitätsart
	   und nicht Gefahr. */
	form[data-tone='danger'] h2 :global(svg) {
		color: var(--bad);
	}

	.text {
		margin: 0;
		font-size: var(--fs-sm);
		line-height: 1.55;
		color: var(--ink-2);
	}

	.knoepfe {
		display: flex;
		justify-content: flex-end;
		gap: var(--sp-3);
	}
</style>
