<script lang="ts">
	/**
	 * Wer angemeldet ist, Weg zur Verwaltung, Abmelden.
	 *
	 * Bewusst **kein Aufklappmenü**. Es sind zwei Aktionen; ein Menü davor
	 * zu setzen hieße, für jede einen Klick mehr zu verlangen — genau der
	 * Ärger, gegen den Abschnitt 1 der Anforderungen geschrieben ist. Auf
	 * schmalen Breiten verschwindet zuerst der Name, nicht die Aktion.
	 */
	import type { SessionUser } from '$lib/server/auth';
	import Button from './Button.svelte';
	import Icon from './Icon.svelte';

	let { user }: { user: SessionUser } = $props();
</script>

<span class="wer" title="Angemeldet als {user.username}">
	<Icon name="waypoint" size={13} />
	{user.displayName}
</span>

{#if user.role === 'admin'}
	<Button variant="ghost" size="sm" icon="list" href="/verwaltung">Nutzer</Button>
{/if}

<form method="POST" action="/abmelden">
	<Button type="submit" variant="ghost" size="sm" icon="close">Abmelden</Button>
</form>

<style>
	.wer {
		display: inline-flex;
		align-items: center;
		gap: var(--sp-2);
		font-size: var(--fs-sm);
		color: var(--ink-3);
		white-space: nowrap;
	}

	form {
		display: contents;
	}

	/* Der Name ist Auskunft, die Knöpfe sind Handlung — wenn es eng wird,
	   geht die Auskunft. */
	@media (max-width: 60rem) {
		.wer {
			display: none;
		}
	}
</style>
