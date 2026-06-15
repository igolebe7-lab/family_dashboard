<script lang="ts">
  import BottomNav from './BottomNav.svelte';

  export let activeRoute: string;
  export let labelledBy: string;
  export let calendar = false;
</script>

<main class:app-screen--calendar={calendar} class="app-screen app-screen--mobile" aria-labelledby={labelledBy}>
  <section class="mobile-shell">
    <slot />
  </section>

  <BottomNav {activeRoute} />
</main>
