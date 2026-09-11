<script lang="ts">
  import { page } from '$app/stores';
  import { onDestroy } from 'svelte';
  import Search from '@lucide/svelte/icons/search';
  import ArrowRight from '@lucide/svelte/icons/arrow-right';
  import { CATEGORY_META } from '$lib/constants/categories';
  import WorkspacePage from '$lib/components/app/WorkspacePage.svelte';
  import { familyStore, getActiveFamilyContext } from '$lib/stores/family.store';
  import { searchItems, type SearchKind } from '$lib/api/search.api';
  import type { Item } from '$lib/types/domain';

  let query = $page.url.searchParams.get('q') ?? '';
  let kind: SearchKind = 'all';
  let archived = false;
  let items: Item[] = [];
  let loading = true;
  let error = '';
  let total = 0;
  let totalPages = 1;
  let currentPage = 1;
  let version = 0;
  let timer: ReturnType<typeof setTimeout>;
  const kinds: { value: SearchKind; label: string }[] = [
    { value: 'all', label: 'Все' }, { value: 'event', label: 'События' },
    { value: 'task', label: 'Дела' }, { value: 'assignment', label: 'Поручения' }
  ];
  const labels: Record<string, string> = { event: 'Событие', task: 'Дело', assignment: 'Поручение', routine: 'Рутина' };

  $: context = getActiveFamilyContext($familyStore);
  $: scheduleSearch(query, kind, archived, context?.familyId, context?.memberId);

  function scheduleSearch(_query: string, _kind: SearchKind, _archived: boolean, _family?: string, _member?: string) {
    clearTimeout(timer);
    version += 1;
    items = [];
    loading = true;
    error = '';
    currentPage = 1;
    timer = setTimeout(() => void load(), 220);
  }

  async function load(append = false) {
    if (!context) { loading = false; return; }
    const request = ++version;
    const nextPage = append ? currentPage + 1 : 1;
    loading = true;
    error = '';
    try {
      const result = await searchItems(context, query, kind, nextPage, archived);
      if (request !== version) return;
      items = append ? [...items, ...result.items] : result.items;
      total = result.totalItems;
      totalPages = result.totalPages;
      currentPage = nextPage;
    } catch {
      if (request === version) error = 'Не удалось загрузить записи. Попробуйте ещё раз.';
    } finally {
      if (request === version) loading = false;
    }
  }

  function dateLabel(item: Item) {
    const value = item.startAt || item.dueAt;
    if (!value) return 'Без срока';
    return new Intl.DateTimeFormat('ru', { day: 'numeric', month: 'long' }).format(new Date(value));
  }

  onDestroy(() => { clearTimeout(timer); version += 1; });
</script>

<WorkspacePage title="Поиск" activeRoute="/app/search">
  <header class="page-heading"><div><p class="section-kicker">Вся семья</p><h1>Поиск</h1></div></header>
  <form class="search-field" role="search" on:submit|preventDefault={() => { clearTimeout(timer); void load(); }}>
    <Search size={22} aria-hidden="true" />
    <input aria-label="Найти запись" bind:value={query} maxlength="120" type="search" placeholder="Название, описание или место" />
    <button class="button button--primary" type="submit">Найти</button>
  </form>
  <div class="search-filters" aria-label="Тип записи">
    {#each kinds as option}
      <button type="button" aria-pressed={kind === option.value} on:click={() => kind = option.value}>{option.label}</button>
    {/each}
  </div>
  <label class="archive-filter"><input type="checkbox" bind:checked={archived} />Архив</label>
  <p class="results-count" aria-live="polite">{loading ? 'Ищем…' : error ? '' : `Найдено: ${total}`}</p>
  {#if error}
    <div class="page-error" role="alert"><p>{error}</p><button class="button button--soft" on:click={() => load()}>Повторить</button></div>
  {:else if !loading && items.length === 0}
    <div class="search-empty"><Search size={32} aria-hidden="true" /><h2>{query ? 'Ничего не найдено' : 'Здесь пока пусто'}</h2><p>{query ? 'Попробуйте другое слово или тип записи.' : 'Новые события и дела появятся здесь.'}</p></div>
  {/if}
  <div class="search-results" aria-busy={loading}>
    {#each items as item (item.id)}
      <a class="search-result" href={`/app/items/${item.id}`}>
        <span class={`item-kind item-kind--${item.kind}`}>{labels[item.kind]}</span>
        <div><h2>{item.title}</h2>{#if item.description}<p>{item.description}</p>{/if}<small>{CATEGORY_META[item.category]?.label} · {dateLabel(item)}</small></div>
        <ArrowRight size={18} aria-hidden="true" />
      </a>
    {/each}
  </div>
  {#if currentPage < totalPages && !error}<button class="button button--soft" disabled={loading} on:click={() => load(true)}>Ещё записи</button>{/if}
</WorkspacePage>

<style>
  .archive-filter { display: inline-flex; align-items: center; gap: 10px; min-height: 44px; color: var(--color-text-muted); }
  .archive-filter input { width: 18px; height: 18px; accent-color: var(--color-green); }
</style>
