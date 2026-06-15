<script lang="ts">
  import Sparkles from '@lucide/svelte/icons/sparkles';

  export let title: string;
  export let body: string;
</script>

<div class="today-empty-state">
  <span aria-hidden="true">
    <Sparkles size={22} strokeWidth={2.2} />
  </span>
  <div>
    <h3>{title}</h3>
    <p>{body}</p>
  </div>
</div>
