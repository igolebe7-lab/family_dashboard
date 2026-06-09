<script lang="ts">
  import Plus from '@lucide/svelte/icons/plus';
  import Button from '$lib/components/ui/Button.svelte';
  import HeaderSearch from './HeaderSearch.svelte';
  import NotificationButton from './NotificationButton.svelte';

  export let greeting: string;
  export let dateLabel: string;
  export let notificationCount = 0;
  export let titleId = 'today-title-desktop';
</script>

<header class="desktop-today-header">
  <div class="desktop-today-header__copy">
    <h1 id={titleId}>{greeting} ☀️</h1>
    <p>{dateLabel}</p>
  </div>

  <div class="desktop-today-header__actions">
    <HeaderSearch />
    <NotificationButton {notificationCount} />
    <Button variant="primary" className="desktop-today-header__create">
      <Plus size={18} strokeWidth={2.35} aria-hidden="true" />
      Создать
    </Button>
  </div>
</header>
