<script lang="ts">
  export let active = false;
  export let type: 'button' | 'submit' | 'reset' = 'button';
  export let onclick: (() => void) | undefined = undefined;
</script>

<button class:chip--active={active} class="chip" {type} {onclick}>
  <slot />
</button>
