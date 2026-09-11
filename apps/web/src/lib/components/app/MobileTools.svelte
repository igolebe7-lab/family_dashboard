<script lang="ts">
  import Search from '@lucide/svelte/icons/search';
  import ListChecks from '@lucide/svelte/icons/list-checks';
  import MessageSquare from '@lucide/svelte/icons/message-square';
</script>

<nav class="mobile-tools" aria-label="Быстрый доступ">
  <a href="/app/search"><Search size={16} aria-hidden="true" />Поиск</a>
  <a href="/app/tasks"><ListChecks size={16} aria-hidden="true" />Дела</a>
  <a href="/app/feed"><MessageSquare size={16} aria-hidden="true" />Лента</a>
</nav>
