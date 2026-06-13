<script lang="ts">
  import Bell from '@lucide/svelte/icons/bell';
  import Sun from '@lucide/svelte/icons/sun';

  export let greeting: string;
  export let dateLabel: string;
  export let notificationCount = 0;
  export let titleId = 'today-title';
</script>

<header class="today-header">
  <div class="today-header__copy">
    <h1 id={titleId}>
      {greeting}
      <Sun size={27} strokeWidth={2.3} aria-hidden="true" />
    </h1>
    <p>{dateLabel}</p>
  </div>

  <a class="icon-button" href="/app/notifications" aria-label="Открыть уведомления">
    <Bell size={23} strokeWidth={2.2} aria-hidden="true" />
    {#if notificationCount > 0}
      <span class="notification-dot" aria-hidden="true"></span>
      <span class="sr-only">Новых уведомлений: {notificationCount}</span>
    {/if}
  </a>
</header>
