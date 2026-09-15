<script lang="ts">
  import { onMount } from 'svelte';
  import Bell from '@lucide/svelte/icons/bell';
  import BellOff from '@lucide/svelte/icons/bell-off';
  import Send from '@lucide/svelte/icons/send';
  import Download from '@lucide/svelte/icons/download';
  import ArrowLeft from '@lucide/svelte/icons/arrow-left';
  import WorkspacePage from '$lib/components/app/WorkspacePage.svelte';
  import { disablePush, enablePush, getPushConfig, testPush, type PushConfig } from '$lib/api/push.api';
  import { getPushDevice } from '$lib/push/device-storage';
  import { pushAvailability, pushErrorMessage } from '$lib/push/push-state';

  type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
  let availability = 'loading';
  let permission = 'default';
  let enabled = false;
  let online = true;
  let installed = false;
  let ios = false;
  let busy = false;
  let error = '';
  let message = '';
  let config: PushConfig | null = null;
  let installEvent: InstallEvent | null = null;

  async function refresh() {
    online = navigator.onLine;
    installed = matchMedia('(display-mode: standalone)').matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
    ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    availability = pushAvailability({ secure: isSecureContext, serviceWorker: 'serviceWorker' in navigator,
      pushManager: 'PushManager' in window, notification: 'Notification' in window, ios, standalone: installed });
    permission = 'Notification' in window ? Notification.permission : 'default';
    try { enabled = Boolean(await getPushDevice()); } catch { enabled = false; }
    if (online) {
      try { config = await getPushConfig(); }
      catch { config = null; error = 'Не удалось проверить сервер уведомлений.'; }
    }
  }
  async function toggle() {
    if (busy) return;
    busy = true; error = ''; message = '';
    // Safari requires this call directly inside the click handler, before network awaits.
    const consent = !enabled && 'Notification' in window ? Notification.requestPermission() : Promise.resolve('granted');
    try {
      if (enabled) { await disablePush(); message = 'Уведомления на этом устройстве выключены.'; }
      else {
        permission = await consent;
        if (permission !== 'granted') return;
        if (!config) throw new Error('Сервер уведомлений недоступен.');
        await enablePush(config); message = 'Уведомления на этом устройстве включены.';
      }
    } catch (cause) { error = pushErrorMessage(cause); }
    finally { busy = false; await refresh(); }
  }
  async function sendTest() {
    busy = true; error = ''; message = '';
    try { await testPush(); message = 'Проверочное уведомление поставлено на отправку.'; }
    catch (cause) { error = pushErrorMessage(cause); }
    finally { busy = false; }
  }
  async function install() {
    await installEvent?.prompt(); await installEvent?.userChoice; installEvent = null; await refresh();
  }
  onMount(() => {
    void refresh();
    const prompt = (event: Event) => { event.preventDefault(); installEvent = event as InstallEvent; };
    const update = () => void refresh();
    window.addEventListener('beforeinstallprompt', prompt);
    for (const name of ['online', 'offline', 'focus', 'appinstalled', 'familytime-push-changed']) window.addEventListener(name, update);
    return () => {
      window.removeEventListener('beforeinstallprompt', prompt);
      for (const name of ['online', 'offline', 'focus', 'appinstalled', 'familytime-push-changed']) window.removeEventListener(name, update);
    };
  });
</script>

<WorkspacePage activeRoute="/app/profile" title="Уведомления">
  <section class="notification-settings">
    <a class="back-link" href="/app/profile"><ArrowLeft size={18} aria-hidden="true" /> Профиль</a>
    <h1>Уведомления</h1>
    <section class="settings-section" aria-labelledby="device-push-title">
      <div class="settings-heading"><Bell size={24} aria-hidden="true" /><h2 id="device-push-title">На этом устройстве</h2></div>
      <p class="status" role="status">{enabled ? 'Включены' : 'Выключены'}</p>
      {#if availability === 'loading'}<p>Проверяем доступность…</p>
      {:else if availability === 'insecure'}<p>Для уведомлений нужен защищённый адрес HTTPS.</p>
      {:else if availability === 'install'}<p>Добавьте FamilyTime на экран «Домой» и откройте с его значка.</p>
      {:else if availability === 'unsupported'}<p>Этот браузер не поддерживает уведомления приложения. На iPhone нужна iOS 16.4 или новее.</p>
      {:else if permission === 'denied'}<p>Уведомления запрещены. Разрешение можно изменить в настройках браузера или приложения в системе.</p>
      {:else if !online}<p>Нет сети. Подключитесь, чтобы включить или проверить уведомления.</p>
      {:else if config && !config.enabled}<p>Сервер уведомлений ещё не настроен. Уведомления внутри приложения доступны.</p>
      {/if}
      <div class="settings-actions">
        <button class="button button--primary" type="button" aria-pressed={enabled} on:click={toggle}
          disabled={busy || (!enabled && (availability !== 'ready' || permission === 'denied' || !online || !config?.enabled))}>
          {#if enabled}<BellOff size={18} aria-hidden="true" />{:else}<Bell size={18} aria-hidden="true" />{/if}
          {busy ? 'Подождите…' : enabled ? 'Выключить' : 'Включить уведомления'}
        </button>
        {#if enabled}<button class="button button--ghost" type="button" on:click={sendTest} disabled={busy || !online || !config?.enabled}><Send size={18} aria-hidden="true" /> Проверить</button>{/if}
      </div>
      {#if error}<p class="feedback" role="alert">{error}</p>{/if}
      {#if message}<p class="feedback" role="status">{message}</p>{/if}
    </section>
    <section class="settings-section" aria-labelledby="installation-title">
      <div class="settings-heading"><Download size={24} aria-hidden="true" /><h2 id="installation-title">FamilyTime на устройстве</h2></div>
      {#if installed}<p>Приложение открыто с домашнего экрана.</p>
      {:else if installEvent}<button class="button button--ghost" type="button" on:click={install}><Download size={18} aria-hidden="true" /> Установить приложение</button>
      {:else if ios}<ol><li>В Safari откройте меню «Поделиться».</li><li>Выберите «На экран Домой» и подтвердите добавление.</li><li>Откройте FamilyTime с нового значка и включите уведомления.</li></ol>
      {:else}<p>Установка доступна через меню браузера, если он поддерживает веб-приложения.</p>{/if}
    </section>
    <section class="settings-section"><h2>Конфиденциальность</h2><p>На экране блокировки отображается только сообщение об обновлении. Подробности доступны после входа. При выходе уведомления этого аккаунта на устройстве отключаются.</p><a class="back-link" href="/app/notifications">Открыть входящие</a></section>
  </section>
</WorkspacePage>

<style>
  .notification-settings { width: 100%; max-width: 48rem; margin-inline: auto; padding: 1rem; }
  h1 { font-size: 1.8rem; margin: 1rem 0 1.5rem; }
  h2 { font-size: 1.15rem; margin: 0; }
  p, li { line-height: 1.55; overflow-wrap: anywhere; }
  .back-link, .settings-heading { display: flex; align-items: center; gap: .65rem; }
  .back-link { min-height: 44px; width: fit-content; }
  .settings-section { padding-block: 1.25rem; border-top: 1px solid var(--color-border, #dce6df); }
  .settings-heading :global(svg) { flex: none; }
  .settings-actions { display: flex; gap: .75rem; flex-wrap: wrap; margin-top: 1rem; }
  .settings-actions button { min-height: 44px; white-space: normal; }
  .status { font-weight: 600; }
  .feedback { margin-top: 1rem; }
  ol { padding-left: 1.25rem; }
</style>
