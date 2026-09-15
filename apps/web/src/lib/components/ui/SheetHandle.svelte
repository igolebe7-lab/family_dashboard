<script lang="ts">
  import { sheetSwipe } from '$lib/composer/sheet-swipe';
  export let onclose: () => void;
  export let disabled = false;
  function dismiss() { if (!disabled) onclose(); }
</script>

<button class="sheet-handle" type="button" aria-label="Закрыть окно" {disabled} use:sheetSwipe={dismiss} on:click={dismiss}><span aria-hidden="true"></span></button>

<style>
  .sheet-handle { display: none; }
  @media (max-width: 1023px) {
    .sheet-handle { display: grid; place-items: center; width: 100%; height: 44px; min-height: 44px; flex-shrink: 0; padding: 0; border: 0; border-radius: 24px 24px 0 0; background: transparent; box-shadow: none; color: var(--family-muted, var(--color-text-muted)); touch-action: none; cursor: grab; }
    .sheet-handle:active { cursor: grabbing; }
    .sheet-handle span { width: 36px; height: 4px; border-radius: 4px; background: currentColor; opacity: .6; }
    .sheet-handle:focus-visible { outline: 2px solid var(--color-blue); outline-offset: -4px; }
  }
</style>
