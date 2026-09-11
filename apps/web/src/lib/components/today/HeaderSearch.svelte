<script lang="ts">
  import Search from '@lucide/svelte/icons/search';

  export let placeholder = 'Найти в семье';
</script>

<form class="header-search" action="/app/search" role="search">
  <label class="sr-only" for="header-query">Поиск по семье</label>
  <Search size={19} strokeWidth={2.25} aria-hidden="true" />
  <input id="header-query" name="q" type="search" {placeholder} maxlength="120" />
</form>
