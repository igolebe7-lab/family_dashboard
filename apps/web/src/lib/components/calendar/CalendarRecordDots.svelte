<script lang="ts">
  import { limitRecordMarkers, type CalendarRecordMarker } from '$lib/calendar/record-markers';
  export let markers: readonly CalendarRecordMarker[] = [];
  $: model = limitRecordMarkers(markers);
  function background(colors: CalendarRecordMarker['colors']) {
    if (colors.length === 1) return `var(--color-${colors[0]})`;
    return `conic-gradient(${colors.map((color, i) => `var(--color-${color}) ${i * 100 / colors.length}% ${(i+1) * 100 / colors.length}%`).join(',')})`;
  }
</script>
{#if markers.length}
  <span class="calendar-record-dots" aria-hidden="true">
    {#each model.visible as marker, index (`${marker.id}-${index}`)}<i class="calendar-record-dot" style:background={background(marker.colors)}></i>{/each}
    {#if model.hidden}<b>+{model.hidden}</b>{/if}
  </span>
{/if}
<style>
  .calendar-record-dots { display: inline-flex; align-items: center; justify-content: center; gap: 2px; max-width: 100%; line-height: 1; }
  .calendar-record-dot { display: block; width: 5px; height: 5px; flex: 0 0 5px; border-radius: 50%; box-shadow: 0 0 0 1px var(--color-surface); }
  b { font-size: 8px; font-weight: 600; color: inherit; white-space: nowrap; }
</style>
