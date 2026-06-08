<script lang="ts">
  export let variant: 'primary' | 'soft' | 'ghost' = 'primary';
  export let type: 'button' | 'submit' | 'reset' = 'button';
  export let href: string | undefined = undefined;
  export let ariaLabel: string | undefined = undefined;
  export let className = '';
</script>

{#if href}
  <a class={`button button--${variant} ${className}`} {href} aria-label={ariaLabel}>
    <slot />
  </a>
{:else}
  <button class={`button button--${variant} ${className}`} {type} aria-label={ariaLabel}>
    <slot />
  </button>
{/if}
