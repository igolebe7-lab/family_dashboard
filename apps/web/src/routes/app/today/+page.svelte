<script lang="ts">
  import { browser } from '$app/environment';
  import DesktopShell from '$lib/components/app/DesktopShell.svelte';
  import MobileShell from '$lib/components/app/MobileShell.svelte';
  import MemberAvatarRow from '$lib/components/family/MemberAvatarRow.svelte';
  import AttentionPanel from '$lib/components/today/AttentionPanel.svelte';
  import DesktopHeader from '$lib/components/today/DesktopHeader.svelte';
  import QuickActions from '$lib/components/today/QuickActions.svelte';
  import TodayHeader from '$lib/components/today/TodayHeader.svelte';
  import TodayTimeline from '$lib/components/today/TodayTimeline.svelte';
  import TodayWeekBoard from '$lib/components/today/TodayWeekBoard.svelte';
  import { getIcon } from '$lib/design/icon-registry';
  import { createTodayViewModel } from '$lib/today/today-view-model';

  const fixtureMode =
    browser && new URLSearchParams(window.location.search).get('fixture') === 'desktop-reference';
  const today = createTodayViewModel(fixtureMode ? { fixture: 'desktop-reference' } : undefined);
  const activeRoute = '/app/today';
</script>

<MobileShell {activeRoute} labelledBy="today-title-mobile">
  <TodayHeader
    titleId="today-title-mobile"
    greeting={today.greeting}
    dateLabel={today.dateLabel}
    notificationCount={today.attentionCount}
  />

  <MemberAvatarRow members={today.familyMembers} />
  <section class="today-mobile-surface" aria-label="Сегодня, внимание и быстрые действия">
    <TodayTimeline items={today.timelineItems} labelledBy="today-timeline-title-mobile" />
    <AttentionPanel items={today.attentionItems} labelledBy="attention-title-mobile" />
    <QuickActions actions={today.quickActions} labelledBy="quick-actions-title-mobile" />
  </section>
</MobileShell>

<DesktopShell {activeRoute} labelledBy="today-title-desktop">
  <DesktopHeader
    titleId="today-title-desktop"
    greeting={today.greeting}
    dateLabel={today.dateLabel}
    notificationCount={today.attentionCount}
  />

  <TodayWeekBoard
    labelledBy="today-week-title-desktop"
    weekLabel={today.weekLabel}
    days={today.weekDays}
    times={today.weekTimes}
    events={today.weekEvents}
  />

  <svelte:fragment slot="aside">
    <AttentionPanel items={today.attentionItems} labelledBy="attention-title-desktop" />
    <QuickActions actions={today.quickActions} labelledBy="quick-actions-title-desktop" />

    <section class="today-feed" aria-labelledby="today-feed-title">
      <div class="section-title-row">
        <div>
          <p class="section-kicker">Последние изменения</p>
          <h2 id="today-feed-title">Семейная лента</h2>
        </div>
      </div>

      <div class="today-feed__list">
        {#each today.feedItems as item (item.id)}
          {@const Icon = getIcon(item.icon)}
          <article class={`today-feed__item today-feed__item--${item.color}`}>
            <span class="today-feed__icon" aria-hidden="true">
              <svelte:component this={Icon} size={17} strokeWidth={2.35} />
            </span>
            <p><strong>{item.actor}</strong> {item.body}</p>
            <time>{item.timeLabel}</time>
          </article>
        {/each}
      </div>

      <a class="today-feed__link" href="/app/feed">Открыть всю ленту ›</a>
    </section>
  </svelte:fragment>
</DesktopShell>
