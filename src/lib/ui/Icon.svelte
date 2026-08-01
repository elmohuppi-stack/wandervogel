<script lang="ts">
	/**
	 * Ein Symbol aus dem eigenen Satz.
	 *
	 * Ohne `label` ist das Icon dekorativ und wird für Screenreader
	 * ausgeblendet — es steht dann neben einem Text, der dasselbe sagt.
	 * Mit `label` ist es die Bedeutung selbst.
	 */
	import { ICONS, type IconName } from './icons';

	interface Props {
		name: IconName;
		/** Kantenlänge. Zahl heißt px; sonst beliebiger CSS-Wert. */
		size?: number | string;
		/** Spart Glyphen: der Berg um 180° ist der tiefste Punkt. */
		rotate?: 0 | 90 | 180 | 270;
		label?: string;
		class?: string;
	}

	let { name, size, rotate = 0, label, class: klass = '' }: Props = $props();

	const dim = $derived(typeof size === 'number' ? `${size}px` : size);
</script>

<!-- {@html} steht hier auf einer Konstanten aus icons.ts. Es gibt keinen
     Weg, an dieser Stelle Nutzereingaben unterzubringen. -->
<svg
	class="icon {klass}"
	viewBox="0 0 24 24"
	fill="none"
	stroke="currentColor"
	stroke-linecap="round"
	stroke-linejoin="round"
	style:width={dim}
	style:height={dim}
	style:rotate={rotate ? `${rotate}deg` : undefined}
	role={label ? 'img' : undefined}
	aria-label={label}
	aria-hidden={label ? undefined : 'true'}
	focusable="false">{@html ICONS[name]}</svg
>

<style>
	.icon {
		width: var(--icon);
		height: var(--icon);
		flex: none;
		/* 1,75 statt Lucides 2,0: bei 16px liest eine 2er-Linie schwer neben
		   den 1px-Kanten der Oberfläche. */
		stroke-width: 1.75;
		vertical-align: -0.15em;
	}

	/* Größere Glyphen brauchen relativ weniger Strich, sonst wirken sie fett. */
	.icon[style*='20px'],
	.icon[style*='28px'] {
		stroke-width: 1.5;
	}
</style>
