<script lang="ts">
  import Cake from '@lucide/svelte/icons/cake';
  import ChevronRight from '@lucide/svelte/icons/chevron-right';
  import { buildTodayCalendarHref } from '$lib/calendar/today-navigation';
  import { formatBirthdayMeta, type UpcomingBirthday } from '$lib/day-annotations/day-annotations';
  import { getDateTimeFormatter } from '$lib/utils/date-format';

  export let items: UpcomingBirthday[] = [];
  export let error = '';
  export let onretry: () => void = () => {};
  export let labelledBy = 'upcoming-birthdays-title';

  function dateLabel(key: string): string {
    return getDateTimeFormatter('ru', { timeZone: 'UTC', day: 'numeric', month: 'long' }).format(new Date(`${key}T00:00:00Z`));
  }
</script>

{#if items.length || error}
  <section class="upcoming-birthdays" aria-labelledby={labelledBy}>
    <h2 id={labelledBy}>Дни рождения</h2>
    {#if error}
      <p role="alert">{error}</p>
      <button type="button" class="button" on:click={onretry}>Повторить</button>
    {/if}
    {#each items as item (item.annotation.id)}
      <a class={`birthday-reminder birthday-reminder--${item.annotation.color}`} href={buildTodayCalendarHref({ dateKey: item.dateKey })}>
        <span class="birthday-reminder__icon" aria-hidden="true"><Cake size={22} /></span>
        <span class="birthday-reminder__body">
          <span class="birthday-reminder__when">{item.daysLeft === 0 ? 'Сегодня' : item.daysLeft === 1 ? 'Завтра' : `Через ${item.daysLeft} дня`} · {dateLabel(item.dateKey)}</span>
          <strong>{item.annotation.title}</strong>
          <span class="birthday-reminder__meta">{formatBirthdayMeta(item.annotation, Number(item.dateKey.slice(0, 4)))}</span>
        </span>
        <ChevronRight size={18} aria-hidden="true" />
      </a>
    {/each}
  </section>
{/if}

<style>
  .upcoming-birthdays { display: grid; gap: 12px; min-width: 0; }
  h2 { font-size: var(--font-size-lg); color: var(--color-text); }
  .birthday-reminder { display: grid; grid-template-columns: 40px minmax(0, 1fr) 18px; align-items: center; gap: 12px; padding: 16px; border: 1px solid var(--family-rim, var(--color-border)); border-radius: var(--radius-lg); background: var(--material-card, var(--color-surface-soft)); box-shadow: var(--material-shadow); color: var(--color-text); text-decoration: none; }
  .birthday-reminder__icon { display: grid; place-items: center; width: 40px; height: 40px; border-radius: var(--radius-sm); background: color-mix(in srgb, var(--birthday-accent, var(--color-green)) 14%, transparent); color: var(--birthday-accent, var(--color-green)); }
  .birthday-reminder__body { display: grid; gap: 4px; min-width: 0; overflow-wrap: anywhere; }
  strong { font-size: var(--font-size-sm); line-height: 1.4; }
  .birthday-reminder__when, .birthday-reminder__meta { font-size: var(--font-size-xs); line-height: 1.5; color: var(--color-text-muted); }
  .birthday-reminder:focus-visible { outline: 3px solid var(--color-blue); outline-offset: 3px; }
  .birthday-reminder--green { --birthday-accent: var(--color-green); }
  .birthday-reminder--blue { --birthday-accent: var(--color-blue); }
  .birthday-reminder--lavender { --birthday-accent: var(--color-lavender); }
  .birthday-reminder--peach { --birthday-accent: var(--color-peach); }
  .birthday-reminder--yellow { --birthday-accent: var(--color-yellow); }
</style>
