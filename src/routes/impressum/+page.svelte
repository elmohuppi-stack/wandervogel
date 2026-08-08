<script lang="ts">
	import { impressum } from '$lib/legal';
	import LegalPage from '$lib/ui/LegalPage.svelte';
</script>

<LegalPage doc={impressum()} />
