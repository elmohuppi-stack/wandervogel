<script lang="ts">
	/**
	 * Ein Hinweis, der eine Antwort auf eine Handlung ist.
	 *
	 * `tone="bad"` bekommt role="alert", damit Screenreader ihn sofort
	 * vorlesen; die übrigen sind role="status" und warten, bis der Nutzer
	 * eine Pause macht.
	 */
	import type { Snippet } from 'svelte';
	import Icon from './Icon.svelte';
	import IconButton from './IconButton.svelte';
	import type { IconName } from './icons';

	interface Props {
		tone?: 'info' | 'ok' | 'warn' | 'bad';
		icon?: IconName;
		onDismiss?: () => void;
		children: Snippet;
	}

	let { tone = 'info', icon, onDismiss, children }: Props = $props();

	const STANDARD: Record<string, IconName> = {
		info: 'info',
		ok: 'check',
		warn: 'alert',
		bad: 'alert'
	};
</script>

<div class="alert {tone}" role={tone === 'bad' ? 'alert' : 'status'}>
	<Icon name={icon ?? STANDARD[tone]} size={14} />
	<div class="text">{@render children()}</div>
	{#if onDismiss}
		<IconButton icon="close" label="Hinweis schließen" size="sm" onclick={onDismiss} />
	{/if}
</div>

<style>
	.alert {
		display: flex;
		align-items: flex-start;
		gap: var(--sp-3);
		padding: var(--sp-4) var(--sp-5);
		border: 1px solid transparent;
		border-radius: var(--r-sm);
		font-size: var(--fs-sm);
		line-height: 1.45;
	}

	.text {
		flex: 1;
		min-width: 0;
	}

	.info {
		background: var(--surface-2);
		border-color: var(--edge);
		color: var(--ink-2);
	}
	.ok {
		background: var(--ok-bg);
		border-color: var(--ok);
		color: var(--ok);
	}
	.warn {
		background: var(--warn-bg);
		border-color: var(--warn);
		color: var(--warn);
	}
	.bad {
		background: var(--bad-bg);
		border-color: var(--bad);
		color: var(--bad);
	}
</style>
