<script lang="ts">
  import CalendarDays from '@lucide/svelte/icons/calendar-days';
  import Card from '$lib/components/ui/Card.svelte';
  import { getCategoryMeta } from '$lib/constants/categories';
  import { getIcon } from '$lib/design/icon-registry';
  import type { TodayTimelineItem } from '$lib/today/today-view-model';
  import TodayEmptyState from './TodayEmptyState.svelte';

  export let items: TodayTimelineItem[] = [];
  export let labelledBy = 'today-timeline-title';
</script>

<Card labelledBy={labelledBy} className="today-timeline-card">
  <div class="section-title-row">
    <div>
      <p class="section-kicker">Расписание и дела</p>
      <h2 id={labelledBy}>Сегодня</h2>
    </div>
    <CalendarDays size={22} strokeWidth={2.1} aria-hidden="true" />
  </div>

  {#if items.length === 0}
    <TodayEmptyState title="Сегодня спокойно" body="Когда появятся события или дела, они будут здесь." />
  {:else}
    <div class="today-timeline-list">
      {#each items as item (item.id)}
        {@const Icon = getIcon(item.icon)}
        {@const category = getCategoryMeta(item.category)}
        <article class={`today-timeline-item today-timeline-item--${item.color}`}>
          <time>{item.time}</time>
          <div class="today-timeline-item__icon" aria-hidden="true">
            <svelte:component this={Icon} size={18} strokeWidth={2.35} />
          </div>
          <div class="today-timeline-item__body">
            <div>
              <h3>{item.title}</h3>
              <p>{item.subtitle}</p>
            </div>
            <span>{category.label}</span>
          </div>
          <span class="today-timeline-item__member" aria-label={item.memberName}>
            {item.memberInitial}
          </span>
        </article>
      {/each}
    </div>
  {/if}
</Card>
