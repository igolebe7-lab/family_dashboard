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
    <span class="today-header__icon" aria-hidden="true">
      <Sun size={18} strokeWidth={2.4} />
    </span>
    <p>{dateLabel}</p>
    <h1 id={titleId}>{greeting}</h1>
  </div>

  <button class="icon-button" type="button" aria-label="Открыть уведомления">
    <Bell size={23} strokeWidth={2.2} aria-hidden="true" />
    {#if notificationCount > 0}
      <span class="notification-dot" aria-hidden="true"></span>
      <span class="sr-only">Новых уведомлений: {notificationCount}</span>
    {/if}
  </button>
</header>
