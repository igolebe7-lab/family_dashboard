<script lang="ts">
  import Bell from '@lucide/svelte/icons/bell';

  export let notificationCount = 0;
</script>

<a class="notification-button" href="/app/notifications" aria-label="Открыть уведомления">
  <Bell size={21} strokeWidth={2.25} aria-hidden="true" />
  {#if notificationCount > 0}
    <span class="notification-dot" aria-hidden="true"></span>
    <span class="sr-only">Новых уведомлений: {notificationCount}</span>
  {/if}
</a>
