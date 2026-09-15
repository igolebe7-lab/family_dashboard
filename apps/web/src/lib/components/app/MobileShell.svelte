<script lang="ts">
  import BottomNav from './BottomNav.svelte';
  import MobileTools from './MobileTools.svelte';

  export let activeRoute: string;
  export let labelledBy: string;
  export let calendar = false;
</script>

<main class:app-screen--calendar={calendar} class="app-screen app-screen--mobile app-screen--glass" aria-labelledby={labelledBy}>
  <section class="mobile-shell">
    <MobileTools />
    <slot />
  </section>

  <BottomNav {activeRoute} />
</main>
