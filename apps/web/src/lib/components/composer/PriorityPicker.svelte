<script lang="ts">
  import type { ItemPriority } from '$lib/types/domain';
  export let value: ItemPriority = 'normal';
</script>
<label><span>Приоритет</span><select aria-label="Приоритет" bind:value>
  <option value="low">Низкий</option><option value="normal">Обычный</option>
  <option value="high">Высокий</option><option value="urgent">Срочно</option>
</select></label>
