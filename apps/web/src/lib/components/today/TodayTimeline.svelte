<script lang="ts">
  import CalendarDays from '@lucide/svelte/icons/calendar-days';
  import ChevronRight from '@lucide/svelte/icons/chevron-right';
  import Card from '$lib/components/ui/Card.svelte';
  import { getIcon } from '$lib/design/icon-registry';
  import type { TodayAllDayItem, TodayTimelineItem } from '$lib/today/today-view-model';
  import TodayEmptyState from './TodayEmptyState.svelte';

  export let items: TodayTimelineItem[] = [];
  export let allDayItems: TodayAllDayItem[] = [];
  export let labelledBy = 'today-timeline-title';
  export let loadDetails:
    | ((item: TodayTimelineItem | TodayAllDayItem) => Promise<Partial<TodayTimelineItem | TodayAllDayItem>>)
    | undefined = undefined;

  let selectedItem: TodayTimelineItem | TodayAllDayItem | null = null;
  let selectedLoading = false;

  async function openItem(item: TodayTimelineItem | TodayAllDayItem): Promise<void> {
    selectedItem = item;
    if (!loadDetails) return;

    selectedLoading = true;
    try {
      const details = await loadDetails(item);
      selectedItem = { ...item, ...details };
    } catch (error) {
      console.warn('Failed to load item details.', error);
    } finally {
      selectedLoading = false;
    }
  }
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

  {#if allDayItems.length > 0}
    <div class="today-all-day-strip" aria-label="События на весь день">
      {#each allDayItems as item (item.id)}
        {@const Icon = getIcon(item.icon)}
        <button
          class={`today-all-day-pill today-all-day-pill--${item.color}`}
          type="button"
          on:click={() => openItem(item)}
        >
          <span class="today-all-day-pill__icon" aria-hidden="true">
            <svelte:component this={Icon} size={19} strokeWidth={2.15} />
          </span>
          <span>
            <strong>{item.title}</strong>
            <small>{item.label} · {item.subtitle}</small>
          </span>
        </button>
      {/each}
    </div>
  {/if}

  {#if items.length === 0 && allDayItems.length === 0}
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
          <button class="today-timeline-item__card" type="button" on:click={() => openItem(item)}>
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
          </button>
        </article>
      {/each}
    </div>
  {/if}
</Card>

{#if selectedItem}
  <div class="today-detail-backdrop">
    <button
      class="today-detail-backdrop__close"
      type="button"
      aria-label="Закрыть детали"
      on:click={() => (selectedItem = null)}
      on:touchmove|preventDefault
    ></button>
    <div
      class={`today-detail-sheet today-detail-sheet--${selectedItem.color}`}
      role="dialog"
      aria-modal="true"
      aria-label={selectedItem.title}
    >
      <p>{'time' in selectedItem ? selectedItem.time : selectedItem.label}</p>
      <h3>{selectedItem.title}</h3>
      <dl class="today-detail-sheet__meta">
        <div>
          <dt>Дата</dt>
          <dd>{selectedItem.dateLabel}</dd>
        </div>
        <div>
          <dt>Категория</dt>
          <dd>{selectedItem.categoryLabel}</dd>
        </div>
        <div>
          <dt>Участники</dt>
          <dd>{selectedItem.participantNames?.join(', ') || selectedItem.subtitle}</dd>
        </div>
        {#if selectedItem.locationText}
          <div>
            <dt>Место</dt>
            <dd>{selectedItem.locationText}</dd>
          </div>
        {/if}
      </dl>
      {#if selectedItem.description}
        <p class="today-detail-sheet__description">{selectedItem.description}</p>
      {:else if selectedLoading}
        <p class="today-detail-sheet__description">Загружаем детали...</p>
      {/if}
      <button type="button" on:click={() => (selectedItem = null)}>Закрыть</button>
    </div>
  </div>
{/if}
