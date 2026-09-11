<script lang="ts">
  import Sidebar from './Sidebar.svelte';

  export let activeRoute: string;
  export let labelledBy: string;
</script>

<main class:desktop-shell--wide={!$$slots.aside} class="desktop-shell" aria-labelledby={labelledBy}>
  <Sidebar {activeRoute} />

  <section class="desktop-main">
    <slot />
  </section>

  {#if $$slots.aside}<aside class="desktop-aside" aria-label="Сводка справа">
    <slot name="aside" />
  </aside>{/if}
</main>
