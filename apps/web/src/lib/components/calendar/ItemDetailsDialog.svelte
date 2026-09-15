<script lang="ts">
  import { onMount } from 'svelte';
  import X from '@lucide/svelte/icons/x';
  import { openComposerDialog } from '$lib/composer/modal-focus';
  import ItemDetails from './ItemDetails.svelte';
  import SheetHandle from '$lib/components/ui/SheetHandle.svelte';
  export let itemId: string;
  export let onclose: () => void;
  let dialog: HTMLDialogElement;
  onMount(() => openComposerDialog(dialog, onclose));
</script>
<dialog bind:this={dialog} class="item-detail-dialog" aria-label="Подробности записи">
  <SheetHandle {onclose} />
  <header class="item-detail-dialog__header">
    <strong>Подробности</strong>
    <button type="button" class="icon-button sheet-desktop-close" aria-label="Закрыть подробности" on:click={onclose}><X size={22} aria-hidden="true" /></button>
  </header>
  <div class="item-detail-dialog__body"><ItemDetails {itemId} /></div>
</dialog>
<style>
  .item-detail-dialog { width: min(680px, calc(100vw - 24px)); max-width: none; max-height: calc(100dvh - 32px); margin: auto; padding: 0; border: 1px solid var(--color-border); border-radius: 8px; background: var(--color-surface); color: var(--color-text); overflow: hidden; }
  .item-detail-dialog[open] { display: flex; flex-direction: column; }
  .item-detail-dialog::backdrop { background: rgb(0 0 0 / 30%); }
  .item-detail-dialog__header { display: flex; align-items: center; justify-content: space-between; padding: 12px 20px; border-bottom: 1px solid var(--color-border); flex-shrink: 0; }
  .item-detail-dialog__body { padding: 20px; overflow-y: auto; overscroll-behavior: contain; min-height: 0; }
  .item-detail-dialog :global(.page-heading) { margin-bottom: 20px; gap: 12px; flex-wrap: wrap; }
  .item-detail-dialog :global(.page-heading h1) { font-size: 22px; overflow-wrap: anywhere; }
  .item-detail-dialog :global(.item-details) { padding: 16px 0; gap: 16px; }
  @media (max-width: 600px) {
    .item-detail-dialog__body { padding: 16px; }
    .item-detail-dialog :global(.item-details) { grid-template-columns: 1fr; }
  }
</style>
