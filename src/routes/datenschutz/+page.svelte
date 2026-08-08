<script lang="ts">
	import { datenschutz } from '$lib/legal';
	import LegalPage from '$lib/ui/LegalPage.svelte';
</script>

<LegalPage doc={datenschutz()} />
