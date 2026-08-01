<script lang="ts">
	/** Hell, Dunkel, System — dieselbe Bedienung wie die Aktivitätsart. */
	import SegmentedControl, { type Segment } from './SegmentedControl.svelte';
	import { theme, type ThemeChoice } from './theme.svelte';

	interface Props {
		size?: 'sm' | 'md';
		labelsHidden?: boolean;
	}

	let { size = 'md', labelsHidden = true }: Props = $props();

	const OPTIONS: Segment[] = [
		{ value: 'light', label: 'Hell', icon: 'sun' },
		{ value: 'dark', label: 'Dunkel', icon: 'moon' },
		{ value: 'system', label: 'System', icon: 'monitor' }
	];
</script>

<SegmentedControl
	options={OPTIONS}
	value={theme.choice}
	label="Darstellung"
	{size}
	{labelsHidden}
	onchange={(v) => theme.set(v as ThemeChoice)}
/>
