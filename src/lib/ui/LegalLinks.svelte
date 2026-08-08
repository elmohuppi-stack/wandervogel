<script lang="ts">
	/**
	 * Impressum und Datenschutz, von jeder Seite erreichbar.
	 *
	 * § 5 DDG verlangt „leicht erkennbar, unmittelbar erreichbar und ständig
	 * verfügbar". Eine App, die überwiegend aus einer bildschirmfüllenden
	 * Karte besteht, hat keinen Platz für eine Fußzeile — deshalb sitzen die
	 * Verweise in der Kopfzeile jeder Ansicht statt unter einem Inhalt, den
	 * es hier nicht gibt.
	 */
	let { size = 'sm' }: { size?: 'sm' | 'xs' } = $props();
</script>

<nav aria-label="Rechtliches" class={size}>
	<a href="/impressum">Impressum</a>
	<span aria-hidden="true">·</span>
	<a href="/datenschutz">Datenschutz</a>
</nav>

<style>
	nav {
		display: inline-flex;
		align-items: center;
		gap: var(--sp-2);
		white-space: nowrap;
		color: var(--ink-3);
	}

	.sm {
		font-size: var(--fs-sm);
	}
	.xs {
		font-size: var(--fs-xs);
	}

	a {
		color: inherit;
		text-decoration: none;
	}

	a:hover {
		color: var(--ink);
		text-decoration: underline;
	}

	a:focus-visible {
		outline: var(--focus-w) solid var(--focus);
		outline-offset: 2px;
		border-radius: var(--r-sm);
	}

	/* Auf schmalen Breiten weicht das Rechtliche den Werkzeugen — es bleibt
	   über die Anmeldeseite und jede Rechtsseite selbst erreichbar. */
	@media (max-width: 48rem) {
		nav {
			display: none;
		}
	}
</style>
