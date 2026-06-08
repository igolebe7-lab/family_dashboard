<script lang="ts">
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import { createShellViewModel } from '$lib/app-shell';
  import { onMount } from 'svelte';

  const shell = createShellViewModel({ apiAvailable: false });

  onMount(() => {
    if (browser) {
      void goto(shell.primaryRoute, { replaceState: true });
    }
  });
</script>

<main class="route-fallback" aria-labelledby="route-fallback-title">
  <section class="shell-card shell-card--narrow">
    <p class="eyebrow">FamilyTime</p>
    <h1 id="route-fallback-title">{shell.title}</h1>
    <p>{shell.message}</p>
    <a class="primary-link" href={shell.primaryRoute}>Открыть Сегодня</a>
  </section>
</main>
