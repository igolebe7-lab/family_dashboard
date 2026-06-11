<script lang="ts">
  import type { ComposerRepeat } from '$lib/composer/composer-form';

  export let value: ComposerRepeat = 'none';
</script>

<label>
  <span>Повтор</span>
  <select bind:value>
    <option value="none">Не повторять</option>
    <option value="daily">Каждый день</option>
    <option value="weekly">Каждую неделю</option>
    <option value="monthly">Каждый месяц</option>
  </select>
</label>
