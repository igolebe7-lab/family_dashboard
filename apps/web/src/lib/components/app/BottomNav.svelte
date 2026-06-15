<script lang="ts">
  import { getIcon, type IconName } from '$lib/design/icon-registry';
  import { primaryNavigation } from '$lib/constants/routes';

  export let activeRoute: string;
</script>

<nav class="bottom-nav" aria-label="Основная навигация">
  {#each primaryNavigation as item}
    {@const Icon = getIcon(item.icon as IconName)}
    <a
      class:bottom-nav__item--active={item.href === activeRoute}
      class="bottom-nav__item"
      href={item.href}
      aria-current={item.href === activeRoute ? 'page' : undefined}
    >
      <Icon size={23} aria-hidden="true" />
      <span>{item.label}</span>
    </a>
  {/each}
</nav>
