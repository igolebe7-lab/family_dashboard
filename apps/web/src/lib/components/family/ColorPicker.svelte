<script lang="ts">
  import Check from '@lucide/svelte/icons/check';
  export let value = 'green';
  const options = [
    ['green', 'Зелёный'], ['blue', 'Синий'], ['lavender', 'Лавандовый'],
    ['peach', 'Персиковый'], ['yellow', 'Жёлтый']
  ];
</script>
<fieldset class="color-picker"><legend>Цвет профиля</legend>
  {#each options as [color, label]}
    <button type="button" style={`--swatch:var(--color-${color})`} aria-label={label} aria-pressed={value === color} title={label} on:click={() => value = color}>{#if value === color}<Check size={18} aria-hidden="true" />{/if}</button>
  {/each}
</fieldset>
<style>
  .color-picker { display: flex; gap: 4px; border: 0; padding: 0; margin: 0; }
  legend { font-size: 14px; margin-bottom: 8px; color: var(--color-text-muted); }
  button { display: grid; place-items: center; width: 44px; height: 44px; border-radius: 50%; border: 5px solid var(--color-bg); background: var(--swatch); color: white; }
  button[aria-pressed=true] { outline: 2px solid var(--swatch); outline-offset: -3px; }
</style>
