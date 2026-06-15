<script lang="ts">
  type SegmentOption = {
    label: string;
    value: string;
  };

  export let label: string;
  export let options: readonly SegmentOption[];
  export let selected: string;
</script>

<div class="segmented" role="tablist" aria-label={label}>
  {#each options as option}
    <button
      class:segmented__active={option.value === selected}
      type="button"
      role="tab"
      aria-selected={option.value === selected}
    >
      {option.label}
    </button>
  {/each}
</div>
