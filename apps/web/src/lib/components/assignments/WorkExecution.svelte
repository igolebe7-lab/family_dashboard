<script lang="ts">
  import { onDestroy } from 'svelte';
  import Check from '@lucide/svelte/icons/check';
  import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
  import { approveOccurrence, markOccurrenceDone, rejectOccurrence, mapOccurrenceRecord } from '$lib/api/occurrences.api';
  import { listWorkDates, toggleChecklistStep } from '$lib/api/work-features.api';
  import { asRecord, getPocketBaseClient, memberRequestOptions, requireCollectionMethod, type ActiveFamilyContext } from '$lib/api/pocketbase';
  import { createWorkViewModels, type AssignmentAction } from '$lib/assignments/assignments-view';
  import { canEditWorkChecklist, latestWorkOccurrence } from '$lib/assignments/work-progress';
  import { familyStore } from '$lib/stores/family.store';
  import { displayTimezone } from '$lib/stores/timezone.store';
  import type { Item, ItemOccurrence } from '$lib/types/domain';
  import WorkMediaPanel from '$lib/components/media/WorkMediaPanel.svelte';

  export let item: Item;
  export let context: ActiveFamilyContext;
  export let occurrenceId: string | undefined = undefined;
  let rows: ItemOccurrence[] = [], selectedId = '', loading = false, busy = false, error = '', returning = false, reason = '';
  let epoch = 0, loadedKey = '', unsubscribe: (() => void) | undefined;
  let mediaBusy = false, photoCount = 0;
  $: key = `${context.familyId}:${context.memberId}:${item.id}:${occurrenceId ?? ''}`;
  $: if (loadedKey !== key) { loadedKey = key; void load(); }
  $: selected = rows.find(row => row.id === selectedId);
  $: card = selected ? createWorkViewModels({ items: [item], occurrences: [selected], members: $familyStore.members, activeMemberId: context.memberId, timezone: $displayTimezone })[0] : undefined;
  $: checked = new Set(selected?.checklistDoneIds ?? []);
  $: count = (item.checklist ?? []).filter(step => checked.has(step.id)).length;
  $: editable = canEditWorkChecklist($familyStore.members.find(member => member.id === context.memberId), item, $familyStore.members, selected);

  function formatDate(row: ItemOccurrence) { return row.dueAt ? new Intl.DateTimeFormat('ru', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: $displayTimezone }).format(new Date(row.dueAt)) : 'Без срока'; }
  async function load() {
    const version = ++epoch; unsubscribe?.(); unsubscribe = undefined;
    rows = []; selectedId = ''; loading = true; busy = false; error = ''; returning = false;
    try {
      const dates = await listWorkDates(item, context, occurrenceId);
      if (version !== epoch) return;
      rows = dates;
      selectedId = occurrenceId ?? dates.find(row => !['done', 'approved', 'cancelled', 'skipped'].includes(row.status))?.id ?? dates[0]?.id ?? '';
      const subscribe = requireCollectionMethod(getPocketBaseClient().collection('item_occurrences'), 'subscribe');
      const release = await subscribe('*', event => {
        if (version !== epoch) return;
        const change = asRecord(event), record = mapOccurrenceRecord(change.record);
        if (record.family !== context.familyId || record.item !== item.id) return;
        rows = change.action === 'delete' ? rows.filter(row => row.id !== record.id) : rows.map(row => row.id === record.id ? latestWorkOccurrence(row, record) : row);
      }, { ...memberRequestOptions(context), filter: `item = "${item.id}"` });
      if (version !== epoch) release(); else unsubscribe = release;
    } catch { if (version === epoch) error = 'Не удалось загрузить выполнение дела. Попробуйте ещё раз.'; }
    finally { if (version === epoch) loading = false; }
  }
  async function acceptMutation(updated: ItemOccurrence, original: ItemOccurrence, version: number) {
    const current = rows.find(row => row.id === updated.id);
    if (!current) return;
    // Equal-millisecond, different concurrent snapshots need one authoritative read.
    if (current !== original && current.updated === updated.updated &&
        (current.status !== updated.status || JSON.stringify(current.checklistDoneIds) !== JSON.stringify(updated.checklistDoneIds))) {
      const [fresh] = await listWorkDates(item, context, updated.id);
      if (version === epoch) rows = rows.map(row => row === current ? latestWorkOccurrence(row, fresh) : row);
    } else rows = rows.map(row => row.id === updated.id ? latestWorkOccurrence(row, updated) : row);
  }
  async function changeStep(stepId: string, done: boolean) {
    if (!selected || !editable || busy) return;
    const version = epoch, current = selected; busy = true; error = '';
    try {
      const updated = await toggleChecklistStep(current.id, stepId, done, context);
      if (version !== epoch) return;
      if (updated.item !== item.id) throw new Error('Wrong item');
      await acceptMutation(updated, current, version);
    } catch { if (version === epoch) error = 'Не удалось сохранить галочку. Проверьте подключение и повторите.'; }
    finally { if (version === epoch) busy = false; }
  }
  async function act(action: AssignmentAction) {
    if (!selected || busy || mediaBusy || !card || ![card.primaryAction, card.secondaryAction].includes(action)) return;
    const version = epoch, current = selected; busy = true; error = '';
    try {
      const updated = await (action === 'approve_assignment' ? approveOccurrence(selected.id, context) : action === 'reject_assignment' ? rejectOccurrence(selected.id, context, reason.trim() || undefined) : markOccurrenceDone(selected.id, context));
      if (version !== epoch) return;
      if (updated.family !== context.familyId || updated.item !== item.id || updated.id !== current.id) throw new Error('Wrong occurrence');
      await acceptMutation(updated, current, version); returning = false;
    } catch { if (version === epoch) error = 'Не удалось изменить статус. Проверьте подключение и права.'; }
    finally { if (version === epoch) busy = false; }
  }
  onDestroy(() => { epoch++; unsubscribe?.(); });
</script>

<section class="work-execution" aria-label="Выполнение дела" aria-busy={loading || busy}>
  {#if loading}<p role="status">Загружаем выполнение…</p>{/if}
  {#if error}<p class="page-error" role="alert">{error}</p>{#if !selected}<button class="button button--soft" on:click={load}>Повторить</button>{/if}{/if}
  {#if !occurrenceId && rows.length > 1}<label class="work-date-choice">Дата дела<select bind:value={selectedId} disabled={busy || mediaBusy}>{#each rows as row (row.id)}<option value={row.id}>{formatDate(row)}</option>{/each}</select></label>{/if}
  {#if selected && card}
    <div class="work-execution__status"><strong>{card.statusLabel}</strong><span>{formatDate(selected)}</span></div>
    {#if item.checklist?.length}
      <h2>Чек-лист <small>{count} из {item.checklist.length}</small></h2>
      <div class="work-checklist">
        {#each item.checklist as step (step.id)}
          <label class:work-checklist--done={checked.has(step.id)}>
            <input type="checkbox" checked={checked.has(step.id)} disabled={busy || !editable} on:change={event => { const done = event.currentTarget.checked; event.currentTarget.checked = checked.has(step.id); void changeStep(step.id, done); }} />
            <span>{step.title}</span>
          </label>
        {/each}
      </div>
    {/if}
    {#if item.points && item.approvalRequired && item.assignees.some(id => $familyStore.members.some(member => member.id === id && ['child', 'teen'].includes(member.role)))}<p class="results-count">Награда за дело: {item.points} баллов · начисляется после подтверждения родителем</p>{/if}
    {#key `${context.familyId}:${context.memberId}:${selected.id}`}
      <WorkMediaPanel occurrenceId={selected.id} itemId={item.id} {context} {editable} disabled={busy} status={selected.status} onbusychange={value => mediaBusy = value} onphotoschange={value => photoCount = value} />
    {/key}
    {#if photoCount && card.primaryAction}<p class="media-cleanup-note">{item.approvalRequired ? card.primaryAction === 'approve_assignment' ? 'После подтверждения фото этого выполнения будут удалены. Ссылки останутся.' : 'Фото сохранятся до подтверждения, затем будут удалены. Ссылки останутся.' : 'После выполнения фото будут удалены. Ссылки останутся.'}</p>{/if}
    {#if card.primaryAction}<div class="detail-actions"><button class="button button--primary" disabled={busy || mediaBusy} on:click={() => card?.primaryAction && act(card.primaryAction)}><Check size={18} aria-hidden="true" />{busy ? 'Сохраняем…' : card.primaryLabel}</button>{#if card.secondaryAction}<button class="button button--soft" disabled={busy || mediaBusy} on:click={() => returning = !returning}><RotateCcw size={18} aria-hidden="true" />Вернуть</button>{/if}</div>{/if}
    {#if returning}<form class="auth-form" on:submit|preventDefault={() => act('reject_assignment')}><label>Что нужно поправить<textarea bind:value={reason} maxlength="400" rows="2" disabled={busy}></textarea></label><button class="button button--soft" disabled={busy}>Вернуть на доработку</button></form>{/if}
  {/if}
</section>

<style>
  .work-execution { border-top: 1px solid var(--color-border); margin-block: 20px; padding-top: 20px; min-width: 0; }
  .work-execution__status { display: flex; justify-content: space-between; flex-wrap: wrap; gap: 8px 16px; margin-bottom: 16px; }
  .work-execution__status span, h2 small { color: var(--color-text-muted); font-size: 13px; font-weight: 400; }
  h2 { font-size: 18px; display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
  .work-checklist { display: grid; gap: 8px; margin-bottom: 16px; }
  .work-checklist label { display: flex; align-items: center; gap: 12px; min-height: 48px; padding: 10px 12px; border: 1px solid var(--color-border); border-radius: 12px; background: var(--color-surface); cursor: pointer; }
  .work-checklist input { width: 20px; height: 20px; flex: 0 0 20px; accent-color: var(--color-green); }
  .work-checklist span { overflow-wrap: anywhere; min-width: 0; }
  .work-checklist--done span { text-decoration: line-through; color: var(--color-text-muted); }
  .work-checklist label:focus-within { outline: 2px solid var(--color-green); outline-offset: 2px; }
  .work-date-choice { display: grid; gap: 8px; margin-bottom: 16px; }
  select { width: 100%; min-width: 0; padding: 10px; font: inherit; }
  .media-cleanup-note { color: var(--color-text-muted); font-size: 13px; line-height: 1.5; overflow-wrap: anywhere; }
</style>
