<script lang="ts">
  import AgendaRow from './AgendaRow.svelte';
  import type { TodayWeekEvent } from '$lib/today/today-view-model';
  export let events: TodayWeekEvent[] = [];
  $: ordered = [...events].sort((a, b) => Number(Boolean(b.allDay)) - Number(Boolean(a.allDay)) || a.start.localeCompare(b.start) || a.id.localeCompare(b.id));
</script>

<div class="today-timeline-list agenda-list">
  {#each ordered as event (event.id)}
    <AgendaRow item={{ ...event, itemId: event.itemId ?? '', time: event.allDay ? 'Весь день' : event.start, subtitle: event.memberName }} />
  {:else}
    <p class="agenda-list__empty">Нет записей</p>
  {/each}
</div>
