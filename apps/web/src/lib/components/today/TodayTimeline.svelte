<script lang="ts">
  import CalendarDays from '@lucide/svelte/icons/calendar-days';
  import ChevronRight from '@lucide/svelte/icons/chevron-right';
  import Card from '$lib/components/ui/Card.svelte';
  import { getIcon } from '$lib/design/icon-registry';
  import type { TodayTimelineItem } from '$lib/today/today-view-model';
  import TodayEmptyState from './TodayEmptyState.svelte';

  export let items: TodayTimelineItem[] = [];
  export let labelledBy = 'today-timeline-title';
</script>

<Card labelledBy={labelledBy} className="today-timeline-card">
  <div class="section-title-row">
    <div>
      <h2 id={labelledBy}>Сегодня</h2>
    </div>
    <button class="today-section-icon-button" type="button" aria-label="Открыть календарь">
      <CalendarDays size={22} strokeWidth={2.1} aria-hidden="true" />
    </button>
  </div>

  {#if items.length === 0}
    <TodayEmptyState title="Сегодня спокойно" body="Когда появятся события или дела, они будут здесь." />
  {:else}
    <div class="today-timeline-list">
      {#each items as item (item.id)}
        {@const Icon = getIcon(item.icon)}
        <article class={`today-timeline-item today-timeline-item--${item.color}`}>
          <div class="today-timeline-item__time">
            <span class="today-timeline-item__dot" aria-hidden="true"></span>
            <time>{item.time}</time>
          </div>
          <div class="today-timeline-item__card">
            <div class="today-timeline-item__icon" aria-hidden="true">
              <svelte:component this={Icon} size={24} strokeWidth={2.25} />
            </div>
            <div class="today-timeline-item__body">
              <h3>{item.title}</h3>
              <p>{item.subtitle}</p>
            </div>
            <span
              class={`today-timeline-item__member portrait portrait--${item.memberPortrait}`}
              aria-label={item.memberName}
            >
              <span class="portrait__face">{item.memberInitial}</span>
            </span>
            <ChevronRight class="today-timeline-item__chevron" size={22} strokeWidth={2.1} aria-hidden="true" />
          </div>
        </article>
      {/each}
    </div>
  {/if}
</Card>
