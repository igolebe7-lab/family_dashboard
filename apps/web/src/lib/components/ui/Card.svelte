<script lang="ts">
  export let as: 'section' | 'article' | 'div' = 'section';
  export let labelledBy: string | undefined = undefined;
  export let className = '';
</script>

<svelte:element this={as} class={`shell-card ${className}`} aria-labelledby={labelledBy}>
  <slot />
</svelte:element>
