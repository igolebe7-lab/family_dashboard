<script lang="ts">
  import { getIcon, type IconName } from '$lib/design/icon-registry';
  import { desktopNavigation } from '$lib/constants/routes';

  export let activeRoute: string;
</script>

<aside class="sidebar" aria-label="Разделы приложения">
  <a class="brand-mark" href="/app/today" aria-label="FamilyTime сегодня">
    <span class="brand-mark__icon">F</span>
    <span>FamilyTime</span>
  </a>

  <nav class="sidebar-nav">
    {#each desktopNavigation as item}
      {@const Icon = getIcon(item.icon as IconName)}
      <a
        class:sidebar-nav__item--active={item.href === activeRoute}
        class="sidebar-nav__item"
        href={item.href}
        aria-current={item.href === activeRoute ? 'page' : undefined}
      >
        <Icon size={21} aria-hidden="true" />
        <span>{item.label}</span>
      </a>
    {/each}
  </nav>

  <section class="family-progress" aria-label="Семейный прогресс">
    <p>Семейный прогресс</p>
    <strong>78%</strong>
    <span class="progress-line" aria-hidden="true"><span></span></span>
  </section>
</aside>
