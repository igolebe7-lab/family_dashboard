<script lang="ts">
  import { page } from '$app/stores';
  import ArrowLeft from '@lucide/svelte/icons/arrow-left';
  import WorkspacePage from '$lib/components/app/WorkspacePage.svelte';
  import ItemDetails from '$lib/components/calendar/ItemDetails.svelte';
</script>
<WorkspacePage title="Запись">
  <a class="back-link" href="/app/today"><ArrowLeft size={18} aria-hidden="true" />Сегодня</a>
  <ItemDetails itemId={$page.params.id ?? ''} />
</WorkspacePage>
