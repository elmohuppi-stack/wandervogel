<script lang="ts">
	/**
	 * Darstellung für Impressum und Datenschutz.
	 *
	 * Eine Komponente für beide, weil sie sich nur im Inhalt unterscheiden —
	 * zwei Seiten mit demselben Aufbau wären zwei Stellen, an denen der
	 * Aufbau auseinanderläuft.
	 *
	 * Lesetext bekommt hier eine begrenzte Zeilenlänge und größere Zeilen-
	 * abstände als der Rest der App. Das ist kein Sonderfall gegen den
	 * Maßsatz, sondern seine Anwendung: die übrigen Bildschirme sind
	 * Werkzeug, dieser ist Fließtext.
	 */
	import { hatPlatzhalter, type LegalDocument } from '$lib/legal';
	import Alert from './Alert.svelte';
	import Button from './Button.svelte';

	let { doc }: { doc: LegalDocument } = $props();
</script>

<svelte:head><title>{doc.title} — Wandervogel</title></svelte:head>

<div class="seite">
	<header>
		<Button variant="ghost" size="sm" icon="chevron-left" href="/">Zurück</Button>
	</header>

	<article>
		<h1>{doc.title}</h1>
		<p class="intro">{doc.intro}</p>

		{#if hatPlatzhalter()}
			<Alert tone="warn">
				<b>Entwurf.</b> Die Betreiberangaben sind noch nicht gesetzt — diese Seite erfüllt
				ihren Zweck erst, wenn die Platzhalter durch echte Angaben ersetzt sind. Sie kommen
				aus den <code>PUBLIC_LEGAL_*</code>-Werten in <code>.env</code>.
			</Alert>
		{/if}

		{#each doc.sections as s (s.title)}
			<section>
				<h2>{s.title}</h2>
				{#if s.items}
					<ul>
						{#each s.items as t (t)}<li>{t}</li>{/each}
					</ul>
				{/if}
				{#each s.paragraphs ?? [] as t (t)}
					<p>{t}</p>
				{/each}
			</section>
		{/each}
	</article>
</div>

<style>
	.seite {
		min-height: 100dvh;
		background: var(--paper);
	}

	header {
		display: flex;
		align-items: center;
		padding: var(--sp-3) var(--sp-4);
		background: var(--surface);
		border-bottom: 1px solid var(--edge);
	}

	article {
		max-width: 44rem;
		margin: 0 auto;
		padding: var(--sp-6) var(--sp-5) var(--sp-7);
	}

	h1 {
		margin: 0 0 var(--sp-3);
		font-size: var(--fs-xl);
		font-weight: 600;
	}

	.intro {
		margin: 0 0 var(--sp-5);
		color: var(--ink-2);
	}

	section {
		margin-top: var(--sp-6);
	}

	h2 {
		margin: 0 0 var(--sp-3);
		font-size: var(--fs-base);
		font-weight: 600;
	}

	p,
	li {
		margin: 0 0 var(--sp-3);
		line-height: 1.6;
		color: var(--ink-2);
	}

	ul {
		margin: 0 0 var(--sp-3);
		padding-left: var(--sp-5);
	}

	code {
		padding: 0 var(--sp-2);
		border-radius: var(--r-sm);
		background: var(--paper-2);
		font-size: 0.9em;
	}
</style>
