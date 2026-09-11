<script lang="ts">
  import type { ItemPriority } from '$lib/types/domain';
  export let value: ItemPriority | 'all' = 'all';
</script>
<label class="priority-filter"><span>Приоритет</span><select aria-label="Приоритет" bind:value>
  <option value="all">Все приоритеты</option><option value="urgent">Срочно</option>
  <option value="high">Высокий</option><option value="normal">Обычный</option><option value="low">Низкий</option>
</select></label>
<style>
  label { display: grid; gap: 5px; min-width: 0; }
  span { color: var(--color-text-muted); font-size: 12px; }
  select { font: inherit; width: 100%; min-height: 44px; padding: 8px; border: 1px solid var(--color-border); border-radius: 8px; background: var(--color-surface); color: var(--color-text); }
  select:focus-visible { outline: 2px solid var(--color-green); outline-offset: 3px; }
</style>
