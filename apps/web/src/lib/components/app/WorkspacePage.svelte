<script lang="ts">
  import Sidebar from './Sidebar.svelte';
  import BottomNav from './BottomNav.svelte';
  import MobileTools from './MobileTools.svelte';
  export let activeRoute = '';
  export let title: string;
</script>

<svelte:head><title>{title} · FamilyTime</title></svelte:head>
<div class="workspace-page">
  <div class="workspace-page__sidebar"><Sidebar {activeRoute} /></div>
  <main class="workspace-page__content">
    <MobileTools />
    <slot />
  </main>
  <div class="workspace-page__mobile-nav"><BottomNav {activeRoute} /></div>
</div>
