<script lang="ts">
  import Button from '$lib/components/ui/Button.svelte';
  import DesktopShell from '$lib/components/app/DesktopShell.svelte';
  import MobileShell from '$lib/components/app/MobileShell.svelte';
  import MemberAvatarRow from '$lib/components/family/MemberAvatarRow.svelte';
  import AttentionPanel from '$lib/components/today/AttentionPanel.svelte';
  import QuickActions from '$lib/components/today/QuickActions.svelte';
  import TodayHeader from '$lib/components/today/TodayHeader.svelte';
  import TodayTimeline from '$lib/components/today/TodayTimeline.svelte';
  import { createShellViewModel } from '$lib/app-shell';
  import { createTodayViewModel } from '$lib/today/today-view-model';

  const shell = createShellViewModel({ apiAvailable: false });
  const today = createTodayViewModel();
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
  <TodayTimeline items={today.timelineItems} labelledBy="today-timeline-title-mobile" />
  <AttentionPanel items={today.attentionItems} labelledBy="attention-title-mobile" />
  <QuickActions actions={today.quickActions} labelledBy="quick-actions-title-mobile" />

  <p class="offline-note" role="status">{shell.message}</p>
</MobileShell>

<DesktopShell {activeRoute} labelledBy="today-title-desktop">
  <div class="today-desktop-header">
    <TodayHeader
      titleId="today-title-desktop"
      greeting={today.greeting}
      dateLabel={today.dateLabel}
      notificationCount={today.attentionCount}
    />
    <Button variant="primary">+ Создать</Button>
  </div>

  <MemberAvatarRow members={today.familyMembers} />
  <TodayTimeline items={today.timelineItems} labelledBy="today-timeline-title-desktop" />

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
        <article>
          <strong>Миша</strong>
          <span>закрыл поручение «Вынести мусор»</span>
        </article>
        <article>
          <strong>Мама</strong>
          <span>добавила событие «Врач»</span>
        </article>
      </div>
    </section>
  </svelte:fragment>
</DesktopShell>
