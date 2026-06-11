<script lang="ts">
  import type { ComposerReminder } from '$lib/composer/composer-form';

  export let value: ComposerReminder = 'none';
</script>

<label>
  <span>Напоминание</span>
  <select bind:value>
    <option value="none">Без напоминания</option>
    <option value="at_time">В момент начала</option>
    <option value="before_15">За 15 минут</option>
    <option value="before_60">За час</option>
    <option value="before_day">За день</option>
  </select>
</label>
