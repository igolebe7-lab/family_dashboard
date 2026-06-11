<script lang="ts">
  import Plus from '@lucide/svelte/icons/plus';

  export let label = 'Создать событие, дело или поручение';
  export let onclick: (() => void) | undefined = undefined;
</script>

<button class="fab" type="button" aria-label={label} on:click={() => onclick?.()}>
  <Plus size={30} strokeWidth={2.4} aria-hidden="true" />
</button>
