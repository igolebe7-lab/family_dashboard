<script lang="ts">
  import Sidebar from './Sidebar.svelte';
  import PanelRight from '@lucide/svelte/icons/panel-right';
  import X from '@lucide/svelte/icons/x';
  import { compactWorkspace } from '$lib/stores/viewport.store';
  import { workspaceInspector } from './workspace-inspector';

  export let activeRoute: string;
  export let labelledBy: string;
  export let inspectorRequest = 0;
  let inspectorOpen = false;
  $: if (inspectorRequest) inspectorOpen = true;
  function closeInspector() { inspectorOpen = false; }
</script>

<main class:desktop-shell--today={activeRoute === '/app/today'} class:desktop-shell--calendar={activeRoute === '/app/calendar'} class:desktop-shell--wide={!$$slots.aside} class="desktop-shell" aria-labelledby={labelledBy}>
  <Sidebar {activeRoute} />

  <section class="desktop-main">
    {#if $$slots.aside && $compactWorkspace}
      <button class="button button--ghost workspace-inspector-trigger" type="button" aria-haspopup="dialog" aria-expanded={inspectorOpen} on:click={() => inspectorOpen = true}>
        <PanelRight size={20} aria-hidden="true" />Сводка
      </button>
    {/if}
    <slot />
  </section>

  {#if $$slots.aside}
    <dialog class="workspace-inspector" aria-label="Сводка" use:workspaceInspector={{ compact: $compactWorkspace, open: inspectorOpen, onclose: closeInspector }}>
      <header class="workspace-inspector-header"><strong>Сводка</strong><button class="icon-button" aria-label="Закрыть сводку" type="button" on:click={closeInspector}><X size={22} aria-hidden="true" /></button></header>
      <aside class="desktop-aside" data-inspector-scroll aria-label="Сводка справа"><slot name="aside" /></aside>
    </dialog>
  {/if}
</main>
