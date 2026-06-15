<script lang="ts">
  import { onMount } from 'svelte';
  import { bootstrapClientApp } from '$lib/stores/app.bootstrap';
  import '../app.css';

  onMount(() => {
    void bootstrapClientApp().catch((error) => {
      console.warn('Failed to bootstrap FamilyTime session.', error);
    });
  });
</script>

<svelte:head>
  <title>FamilyTime</title>
  <meta
    name="description"
    content="Семейный календарь, дела и поручения для спокойной координации дня."
  />
</svelte:head>

<slot />
