<script lang="ts">
  import Search from '@lucide/svelte/icons/search';

  export let placeholder = 'Поиск событий, дел, поручений...';
</script>

<label class="header-search">
  <span class="sr-only">Поиск</span>
  <Search size={19} strokeWidth={2.25} aria-hidden="true" />
  <input type="search" {placeholder} />
</label>
