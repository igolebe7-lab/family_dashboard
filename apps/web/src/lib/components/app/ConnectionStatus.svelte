<script lang="ts">
  import { onMount } from 'svelte';
  import { dev } from '$app/environment';
  import WifiOff from '@lucide/svelte/icons/wifi-off';
  import RefreshCw from '@lucide/svelte/icons/refresh-cw';
  let offline = false;
  let waitingWorker: ServiceWorker | null = null;
  let refreshing = false;

  onMount(() => {
    let active = true;
    let registration: ServiceWorkerRegistration | undefined;
    let installing: ServiceWorker | null = null;
    const updateOnline = () => {
      offline = !navigator.onLine;
      if (!offline) void registration?.update().catch(() => {});
    };
    const inspectWorker = () => {
      if (active && navigator.serviceWorker.controller) waitingWorker = registration?.waiting ?? null;
    };
    const onUpdate = () => {
      installing?.removeEventListener('statechange', inspectWorker);
      installing = registration?.installing ?? null;
      installing?.addEventListener('statechange', inspectWorker);
    };
    const onController = () => { if (refreshing) window.location.reload(); };
    updateOnline();
    window.addEventListener('online', updateOnline);
    window.addEventListener('offline', updateOnline);
    if (!dev && 'serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('controllerchange', onController);
      void navigator.serviceWorker.getRegistration().then((value) => {
        if (!active) return;
        registration = value;
        inspectWorker();
        onUpdate();
        if (navigator.onLine) void registration?.update().catch(() => {});
        registration?.addEventListener('updatefound', onUpdate);
      }).catch(() => {});
    }
    return () => {
      active = false;
      window.removeEventListener('online', updateOnline);
      window.removeEventListener('offline', updateOnline);
      registration?.removeEventListener('updatefound', onUpdate);
      installing?.removeEventListener('statechange', inspectWorker);
      navigator.serviceWorker?.removeEventListener('controllerchange', onController);
    };
  });

  function updateApp() {
    if (!waitingWorker || !window.confirm('Обновить приложение? Страница перезагрузится. Сохраните незавершённые изменения перед обновлением.')) return;
    refreshing = true;
    waitingWorker?.postMessage({ type: 'ACTIVATE_UPDATE' });
  }
</script>

{#if offline}
  <div class="connectivity-banner" role="status"><WifiOff size={18} aria-hidden="true" /><span>Нет сети. Изменения пока не сохраняются.</span></div>
{:else if waitingWorker}
  <div class="connectivity-banner" role="status"><RefreshCw size={18} aria-hidden="true" /><span>Доступна новая версия</span><button type="button" disabled={refreshing} on:click={updateApp}>Обновить</button></div>
{/if}
