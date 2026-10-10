<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { protectedFileUrl } from '$lib/api/files.api';
  import { getPocketBaseClient } from '$lib/api/pocketbase';

  export let collection: string;
  export let id: string;
  export let filename: string;
  export let alt = '';
  export let thumb: string | undefined = undefined;
  export let className = '';

  let mounted = false;
  let authToken = '';
  let authRevision = 0;
  let src = '';
  let retried = false;
  let request = 0;
  let unsubscribe: (() => void) | undefined;

  $: if (mounted) {
    authRevision;
    void load(collection, id, filename, thumb, authToken);
  }

  async function load(nextCollection: string, nextId: string, nextFilename: string, nextThumb: string | undefined, token: string, refresh = false): Promise<void> {
    const revision = ++request;
    src = '';
    if (!refresh) retried = false;
    if (!token || !nextFilename) return;
    try {
      const url = await protectedFileUrl(nextCollection, nextId, nextFilename, nextThumb, refresh);
      if (mounted && request === revision && getPocketBaseClient().authStore.token === token) src = url;
    } catch { /* Keep the fallback; never expose a public URL on auth failure. */ }
  }

  function imageFailed(): void {
    src = '';
    if (retried) return;
    retried = true;
    void load(collection, id, filename, thumb, authToken, true);
  }

  onMount(() => {
    mounted = true;
    const store = getPocketBaseClient().authStore;
    authToken = store.token;
    unsubscribe = store.onChange?.(token => { request++; src = ''; authToken = token; authRevision++; });
  });
  onDestroy(() => { mounted = false; request++; unsubscribe?.(); });
</script>

<span class={`protected-image ${className}`}>
  {#if src}
    <img {src} {alt} on:error={imageFailed} decoding="async" />
  {:else}
    <slot><span class="protected-image__placeholder" role={alt ? 'img' : undefined} aria-label={alt || undefined}></span></slot>
  {/if}
</span>

<style>
  .protected-image { display: grid; width: 100%; height: 100%; overflow: hidden; }
  img { display: block; width: 100%; height: 100%; min-width: 0; min-height: 0; object-fit: cover; }
  .protected-image__placeholder { width: 100%; height: 100%; background: var(--color-surface-muted, var(--color-surface)); }
</style>
