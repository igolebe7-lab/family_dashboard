<script lang="ts">
  import { onMount } from 'svelte';
  import Sun from '@lucide/svelte/icons/sun';
  import Moon from '@lucide/svelte/icons/moon';
  import Monitor from '@lucide/svelte/icons/monitor';

  export let id = 'theme';
  let selected = 'system';
  let storageUnavailable = false;
  const options = [
    { value: 'light', label: 'Светлая', icon: Sun },
    { value: 'dark', label: 'Тёмная', icon: Moon },
    { value: 'system', label: 'Как в системе', icon: Monitor }
  ];
  onMount(() => {
    const sync = () => {
      selected = document.documentElement.dataset.themePreference || 'system';
      storageUnavailable = document.documentElement.dataset.themeStorage === 'unavailable';
    };
    sync(); window.addEventListener('familytime:theme-change', sync);
    return () => window.removeEventListener('familytime:theme-change', sync);
  });
</script>

<section class="theme-settings" aria-labelledby={`${id}-title`}>
  <h2 id={`${id}-title`}>Оформление</h2>
  <fieldset>
    <legend class="sr-only">Тема приложения</legend>
    {#each options as option}
      <label class:theme-option--selected={selected === option.value}>
        <input type="radio" name={id} value={option.value} checked={selected === option.value}
          on:change={() => window.dispatchEvent(new CustomEvent('familytime:set-theme', { detail: option.value }))} />
        <svelte:component this={option.icon} size={22} aria-hidden="true" />
        <span>{option.label}</span>
      </label>
    {/each}
  </fieldset>
  {#if storageUnavailable}<p role="status">Браузер не разрешил сохранить тему. Выбор действует до перезагрузки.</p>{/if}
</section>

<style>
  .theme-settings { display: grid; gap: 14px; min-width: 0; }
  h2 { font-size: 18px; }
  fieldset { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; border: 0; padding: 0; margin: 0; }
  label { position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; min-height: 92px; padding: 12px 6px; border: 1px solid var(--color-border); border-radius: 12px; background: var(--color-surface); color: var(--color-text-muted); cursor: pointer; text-align: center; }
  label.theme-option--selected { border-color: var(--color-green); background: var(--color-green-soft); color: var(--color-green); box-shadow: inset 0 0 0 1px var(--color-green); }
  label:focus-within { outline: 3px solid var(--color-blue); outline-offset: 3px; }
  input { position: absolute; inset: 0; width: 100%; height: 100%; margin: 0; opacity: 0; cursor: pointer; }
  span { font-size: 13px; line-height: 1.4; }
  p { font-size: 13px; color: var(--color-text-muted); }
</style>
