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

  <section class="sidebar-family" aria-label="Семья">
    <p>Семья</p>
    <div class="sidebar-family__list">
      <span class="sidebar-family__member">
        <span class="sidebar-family__avatar portrait portrait--mom" aria-hidden="true">
          <span class="portrait__face">М</span>
        </span>
        <span>Мама</span>
      </span>
      <span class="sidebar-family__member">
        <span class="sidebar-family__avatar portrait portrait--dad" aria-hidden="true">
          <span class="portrait__face">П</span>
        </span>
        <span>Папа</span>
      </span>
      <span class="sidebar-family__member">
        <span class="sidebar-family__avatar portrait portrait--misha" aria-hidden="true">
          <span class="portrait__face">М</span>
        </span>
        <span>Миша</span>
      </span>
      <span class="sidebar-family__member">
        <span class="sidebar-family__avatar portrait portrait--anya" aria-hidden="true">
          <span class="portrait__face">А</span>
        </span>
        <span>Аня</span>
      </span>
    </div>
  </section>

  <section class="family-progress" aria-label="Семейный прогресс">
    <p>Семейный прогресс</p>
    <strong>78%</strong>
    <span class="progress-line" aria-hidden="true"><span></span></span>
  </section>
</aside>
