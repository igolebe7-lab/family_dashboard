<script lang="ts">
  import ChevronRight from '@lucide/svelte/icons/chevron-right';
  import { getIcon } from '$lib/design/icon-registry';
  import { itemDetailsStore } from '$lib/stores/item-details.store';
  import type { TodayTimelineItem } from '$lib/today/today-view-model';

  export let item: Pick<TodayTimelineItem, 'id' | 'itemId' | 'time' | 'title' | 'subtitle' | 'icon' | 'color'>;
  export let onopen: (() => void) | undefined = undefined;
  $: Icon = getIcon(item.icon);
  function open() {
    if (onopen) onopen();
    else if (item.itemId) itemDetailsStore.set(item.itemId);
  }
</script>

<article class={`today-timeline-item today-timeline-item--${item.color}`}>
  <div class="today-timeline-item__time">
    <span class="today-timeline-item__dot" aria-hidden="true"></span>
    <time>{item.time}</time>
  </div>
  <button class="today-timeline-item__card" type="button" on:click={open}>
    <span class="today-timeline-item__icon" aria-hidden="true"><svelte:component this={Icon} size={24} strokeWidth={2.25} /></span>
    <span class="today-timeline-item__body"><strong>{item.title}</strong><span>{item.subtitle}</span></span>
    <ChevronRight class="today-timeline-item__chevron" size={20} aria-hidden="true" />
  </button>
  <slot />
</article>
