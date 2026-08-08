<script lang="ts">
	/**
	 * Die Navigationsschiene — das Gerüst der App.
	 *
	 * Ersetzt die Kopfzeile, die auf jeder Seite eine eigene war: Marke,
	 * Navigation, Konto, Thema und die Rechtsverweise standen dort in
	 * wechselnder Reihenfolge nebeneinander und drängten sich vor die Karte.
	 * Alles Seitenübergreifende liegt jetzt hier, alles Seitenspezifische
	 * bleibt bei der Seite.
	 *
	 * **Eingeklappt bleibt jede Tür sichtbar.** Eine Schiene, die im
	 * schmalen Zustand nur noch ein Hamburgersymbol zeigt, versteckt genau
	 * das, was Abschnitt 7 sichtbar haben will — die Symbole bleiben, nur
	 * die Beschriftung geht. Das ist der Unterschied zwischen „zurücktreten"
	 * und „abwesend".
	 */
	import { page } from '$app/state';
	import type { SessionUser } from '$lib/server/auth';
	import Icon from './Icon.svelte';
	import { schiene } from './sidepanel.svelte';
	import ThemeToggle from './ThemeToggle.svelte';
	import type { IconName } from './icons';

	interface Props {
		user?: SessionUser;
		/**
		 * Nur für Beschriftung und `aria-expanded`.
		 *
		 * Die **Breite** hängt nicht daran, sondern an `html[data-nav]`, das
		 * das Inline-Skript in app.html vor dem ersten Anstrich setzt. Sonst
		 * ergäbe die serverseitig gerenderte Seite immer eine breite Schiene,
		 * die nach der Hydration sichtbar zusammenschnappt.
		 */
		collapsed: boolean;
		onToggle: () => void;
	}

	let { user, collapsed, onToggle }: Props = $props();

	interface Eintrag {
		href: string;
		label: string;
		icon: IconName;
		/** Auch für Unterseiten hervorheben. */
		praefix?: boolean;
	}

	const eintraege = $derived<Eintrag[]>([
		{ href: '/', label: 'Touren', icon: 'list' },
		{ href: '/planen', label: 'Neue Tour', icon: 'plus', praefix: true },
		...(user?.role === 'admin'
			? [{ href: '/verwaltung', label: 'Nutzer', icon: 'waypoint' } as Eintrag]
			: [])
	]);

	const aktiv = (e: Eintrag) =>
		e.praefix ? page.url.pathname.startsWith(e.href) : page.url.pathname === e.href;
</script>

<nav class="rail" aria-label="Hauptnavigation">
	<a class="marke" href="/" title="Wandervogel">
		<!-- Dasselbe W wie im Favicon, damit Tab und App zusammengehören. -->
		<svg class="mark" viewBox="0 0 32 32" aria-hidden="true">
			<rect width="32" height="32" rx="7" />
			<path d="M7 10 L11.6 22 L16 14 L20.4 22 L25 10" />
		</svg>
		<span class="wort">Wandervogel</span>
	</a>

	<ul>
		{#each eintraege as e (e.href)}
			<li>
				<a href={e.href} class:aktiv={aktiv(e)} aria-current={aktiv(e) ? 'page' : undefined}>
					<Icon name={e.icon} size={16} />
					<span class="wort">{e.label}</span>
				</a>
			</li>
		{/each}
	</ul>

	<!--
		Der Platz der Seite. Die Startseite hängt hier ihre Tourenliste ein;
		Planer und Verwaltung lassen ihn leer und die Schiene bleibt schmal.
	-->
	{#if schiene.inhalt}
		<div class="seitenteil">{@render schiene.inhalt()}</div>
	{/if}

	<div class="unten">
		<ThemeToggle size="sm" />

		{#if user}
			<span class="wer" title="Angemeldet als {user.username}">
				<Icon name="waypoint" size={14} />
				<span class="wort">{user.displayName}</span>
			</span>
			<form method="POST" action="/abmelden">
				<button type="submit" title="Abmelden">
					<Icon name="close" size={16} />
					<span class="wort">Abmelden</span>
				</button>
			</form>
		{:else}
			<a href="/anmelden" title="Anmelden">
				<Icon name="check" size={16} />
				<span class="wort">Anmelden</span>
			</a>
		{/if}

		<!-- Ganz unten und klein: erreichbar von jeder Seite, wie § 5 DDG es
		     verlangt, aber nicht vor der Karte. -->
		<div class="recht wort">
			<a href="/impressum">Impressum</a>
			<a href="/datenschutz">Datenschutz</a>
		</div>

		<button
			class="klapp"
			type="button"
			onclick={onToggle}
			aria-expanded={!collapsed}
			title={collapsed ? 'Menü ausklappen' : 'Menü einklappen'}
		>
			<Icon name="chevron-left" size={16} />
			<span class="wort">Einklappen</span>
		</button>
	</div>
</nav>

<style>
	.rail {
		display: flex;
		flex-direction: column;
		gap: var(--sp-2);
		width: 12.5rem;
		padding: var(--sp-4) var(--sp-3);
		background: var(--surface);
		border-right: 1px solid var(--edge);
		overflow: hidden;
		transition: width var(--dur-1) var(--ease);
	}

	/* Trägt die Schiene den Inhalt einer Seite, braucht sie Listenbreite —
	   sonst müsste die Tourenkarte auf 12,5 rem lesbar sein. */
	.rail:has(.seitenteil) {
		width: var(--list-w);
	}

	.seitenteil {
		flex: 1;
		min-height: 0;
		display: flex;
		flex-direction: column;
		margin: var(--sp-3) calc(-1 * var(--sp-3)) 0;
		border-top: 1px solid var(--edge-soft);
	}

	:global(html[data-nav='schmal']) .seitenteil {
		display: none;
	}

	:global(html[data-nav='schmal']) .rail {
		width: 3.25rem;
	}

	/* Der Trick der ganzen Schiene: eingeklappt verschwinden nur die Wörter.
	   Symbole, Reihenfolge und Trefffläche bleiben, wo sie waren. */
	:global(html[data-nav='schmal']) .wort {
		display: none;
	}

	.marke {
		display: flex;
		align-items: center;
		gap: var(--sp-3);
		padding: var(--sp-2);
		margin-bottom: var(--sp-3);
		text-decoration: none;
		color: var(--ink);
		font-weight: 600;
		white-space: nowrap;
	}

	.mark {
		width: 22px;
		height: 22px;
		flex: none;
	}
	.mark rect {
		fill: var(--route-hike);
	}
	.mark path {
		fill: none;
		stroke: var(--surface);
		stroke-width: 2.6;
		stroke-linecap: round;
		stroke-linejoin: round;
	}

	ul {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: var(--sp-1, 2px);
	}

	.unten {
		margin-top: auto;
		border-top: 1px solid var(--edge-soft);
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: var(--sp-2);
		padding-top: var(--sp-4);
	}

	/* Ohne das dehnt der Umschalter sich über die ganze Schienenbreite und
	   seine Auswahlmarkierung steht als graue Fläche daneben. */
	.unten :global(> [role='radiogroup']),
	.unten :global(> div:has([role='radio'])) {
		align-self: flex-start;
	}

	/*
	 * Eingeklappt ohne Themenumschalter — die ehrliche Ausnahme.
	 *
	 * Navigation und Konto bleiben als Symbole sichtbar; ein dreiteiliger
	 * Umschalter passt in 3,25 rem nicht, ohne zu drei gestapelten Knöpfen
	 * zu werden. Er ist mit einem Klick auf „Ausklappen" wieder da, und
	 * anders als eine Navigationstür sucht ihn niemand unter Zeitdruck.
	 */
	:global(html[data-nav='schmal']) .unten :global(> [role='radiogroup']),
	:global(html[data-nav='schmal']) .unten :global(> div:has([role='radio'])) {
		display: none;
	}

	/* Ein Aussehen für Verweise und Knöpfe: sie tun hier dasselbe, also
	   sollen sie nicht verschieden aussehen. */
	.rail :is(li a, .unten a, .unten button) {
		display: flex;
		align-items: center;
		gap: var(--sp-3);
		width: 100%;
		padding: var(--sp-2) var(--sp-3);
		border: none;
		border-radius: var(--r-sm);
		background: none;
		color: var(--ink-2);
		font: inherit;
		font-size: var(--fs-sm);
		text-align: left;
		text-decoration: none;
		white-space: nowrap;
		cursor: pointer;
	}

	.rail :is(li a, .unten a, .unten button):hover {
		background: var(--paper-2);
		color: var(--ink);
	}

	.rail :is(li a, .unten a, .unten button):focus-visible {
		outline: var(--focus-w) solid var(--focus);
		outline-offset: -1px;
	}

	li a.aktiv {
		background: var(--paper-2);
		color: var(--ink);
		font-weight: 600;
	}

	.wer {
		display: flex;
		align-items: center;
		gap: var(--sp-3);
		padding: var(--sp-2) var(--sp-3);
		font-size: var(--fs-sm);
		color: var(--ink-3);
		white-space: nowrap;
		overflow: hidden;
	}

	.recht {
		display: flex;
		flex-wrap: wrap;
		gap: 0 var(--sp-3);
		padding: var(--sp-2) var(--sp-3);
	}

	.recht a {
		padding: 0;
		font-size: var(--fs-xs);
		color: var(--ink-3);
	}
	.recht a:hover {
		background: none;
		text-decoration: underline;
	}

	.klapp :global(svg) {
		transition: rotate var(--dur-1) var(--ease);
	}
	:global(html[data-nav='schmal']) .klapp :global(svg) {
		rotate: 180deg;
	}

	form {
		display: contents;
	}
</style>
