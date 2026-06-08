<script lang="ts">
  export let active = false;
  export let type: 'button' | 'submit' | 'reset' = 'button';
</script>

<button class:chip--active={active} class="chip" {type}>
  <slot />
</button>
