<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import Save from '@lucide/svelte/icons/save';
  import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
  import { getWorkMedia, saveWorkMedia, subscribeWorkMedia, type WorkLink, type WorkMedia } from '$lib/api/work-media.api';
  import type { ActiveFamilyContext } from '$lib/api/pocketbase';
  import { mergeWorkLinkDraft, sameWorkLinks, workLinkDraftPatch } from '$lib/media/work-link-draft';
  import WorkMediaDraft from './WorkMediaDraft.svelte';

  export let occurrenceId: string;
  export let itemId: string;
  export let context: ActiveFamilyContext;
  export let editable = false;
  export let disabled = false;
  export let status = '';
  export let onbusychange: ((busy: boolean) => void) | undefined = undefined;
  export let onphotoschange: ((count: number) => void) | undefined = undefined;
  let media: WorkMedia | null = null;
  let photos: File[] = [], links: WorkLink[] = [], removePhotos: string[] = [];
  let baseLinks: WorkLink[] = [], linksConflict = false, resolvingConflict = false;
  let loading = true, saving = false, preparing = false, ready = true, mounted = false;
  let error = '', message = '', liveError = '';
  let epoch = 0, readVersion = 0, loadedKey = '', loadedStatus = '';
  let unsubscribe: (() => void) | undefined;
  let draftVersion = 0;
  $: key = `${context.familyId}:${context.memberId}:${itemId}:${occurrenceId}`;
  $: linksEdited = !sameWorkLinks(baseLinks, links);
  $: dirty = Boolean(photos.length || removePhotos.length || linksEdited || linksConflict);
  $: onbusychange?.(saving || preparing || resolvingConflict || dirty || !ready);
  $: onphotoschange?.(media?.photos.length ?? 0);
  $: if (mounted && key !== loadedKey) { loadedKey = key; loadedStatus = status; void loadScope(); }
  $: if (mounted && key === loadedKey && status !== loadedStatus) { loadedStatus = status; resetDraft(); void refresh(); }
  $: if (!editable && (dirty || !ready)) resetDraft();
  onMount(() => { mounted = true; });

  function resetDraft() {
    const draft = mergeWorkLinkDraft([], [], media?.links ?? []);
    draftVersion++; photos = []; removePhotos = []; links = draft.links; baseLinks = draft.baseLinks; linksConflict = false;
    preparing = false; ready = true; message = '';
  }
  function assertScope(value: WorkMedia | null, active: ActiveFamilyContext, occurrence: string, item: string) {
    if (value && (value.family !== active.familyId || value.occurrence !== occurrence || value.item !== item)) throw new Error('Wrong media scope');
  }
  async function refresh(discardLinks = false) {
    const currentEpoch = epoch, request = ++readVersion;
    const active = { ...context }, occurrence = occurrenceId, item = itemId;
    if (discardLinks) resolvingConflict = true;
    try {
      const value = await getWorkMedia(occurrence, active);
      if (currentEpoch !== epoch || request !== readVersion) return;
      assertScope(value, active, occurrence, item);
      const draft = discardLinks
        ? mergeWorkLinkDraft([], [], value?.links ?? [])
        : mergeWorkLinkDraft(baseLinks, links, value?.links ?? [], linksConflict);
      const keepDraft = editable && Boolean(photos.length || removePhotos.length || draft.linksEdited || draft.conflict || (!ready && !discardLinks));
      media = value;
      baseLinks = draft.baseLinks; links = draft.links; linksConflict = draft.conflict;
      if (discardLinks) { draftVersion++; ready = true; message = ''; }
      if (!keepDraft) { const previousMessage = message; resetDraft(); message = previousMessage; }
      error = '';
    } catch { if (currentEpoch === epoch && request === readVersion) error = 'Не удалось загрузить вложения. Проверьте подключение и повторите.'; }
    finally { if (currentEpoch === epoch && request === readVersion) { loading = false; resolvingConflict = false; } }
  }
  async function loadScope() {
    const version = ++epoch; ++readVersion;
    unsubscribe?.(); unsubscribe = undefined;
    media = null; resetDraft(); loading = true; saving = false; resolvingConflict = false; error = ''; liveError = '';
    const active = { ...context }, occurrence = occurrenceId;
    // Subscribe before reading to avoid missing a mutation between GET and subscription.
    try {
      const release = await subscribeWorkMedia(occurrence, active, () => { if (version === epoch) void refresh(); });
      if (version !== epoch) { release(); return; }
      unsubscribe = release;
    } catch { if (version === epoch) liveError = 'Обновления вложений недоступны. Можно обновить вручную.'; }
    if (version === epoch) await refresh();
  }
  async function save() {
    if (!editable || disabled || saving || preparing || resolvingConflict || linksConflict || !ready || !dirty) return;
    const version = epoch, active = { ...context }, occurrence = occurrenceId, item = itemId;
    let linkPatch: ReturnType<typeof workLinkDraftPatch>;
    try { linkPatch = workLinkDraftPatch(baseLinks, links, linksConflict); }
    catch (cause) { error = cause instanceof Error ? cause.message : 'Проверьте ссылки.'; return; }
    saving = true; error = ''; message = ''; ++readVersion;
    try {
      const updated = await saveWorkMedia(occurrence, { photos, removePhotos, ...linkPatch }, active);
      if (version !== epoch) return;
      assertScope(updated, active, occurrence, item);
      ++readVersion; media = updated; resetDraft();
      // An occurrence can finish while an upload is in flight; GET observes server-side cleanup.
      await refresh();
      if (version === epoch) message = 'Вложения сохранены';
    } catch (cause) {
      if (version === epoch) {
        if (cause && typeof cause === 'object' && 'status' in cause && cause.status === 409) { linksConflict = true; error = ''; void refresh(); }
        else error = 'Не удалось сохранить вложения. Фото остались в черновике; проверьте подключение и права.';
      }
    }
    finally { if (version === epoch) saving = false; }
  }
  onDestroy(() => { epoch++; readVersion++; unsubscribe?.(); photos = []; onbusychange?.(false); });
</script>

<section class="work-media-panel" aria-label="Вложения этого выполнения" aria-busy={loading || saving || preparing || resolvingConflict}>
  <h2>Вложения</h2>
  {#if loading}<p class="media-note" role="status">Загружаем вложения…</p>
  {:else}
    {#key draftVersion}<WorkMediaDraft bind:photos bind:links bind:removePhotos {media} editable={editable && !loading} disabled={disabled || saving || resolvingConflict} bind:preparing bind:ready />{/key}
    {#if !editable && !media?.photos.length && !media?.links.length}<p class="media-note">Вложений нет</p>{/if}
    {#if linksConflict}<div class="page-error" role="alert"><p>Ссылки изменились у другого участника. Ваши изменения не сохранены. Отмените изменения ссылок и загрузите актуальные; черновик фото останется.</p><button type="button" class="button button--soft" disabled={disabled || saving || preparing || resolvingConflict} on:click={() => refresh(true)}><RotateCcw size={18} aria-hidden="true" />{resolvingConflict ? 'Обновляем…' : 'Отменить изменения ссылок и обновить'}</button></div>{/if}
    {#if editable && (dirty || !ready)}<div class="media-actions"><button type="button" class="button button--primary" disabled={disabled || saving || preparing || resolvingConflict || linksConflict || !ready || !dirty} on:click={save}><Save size={18} aria-hidden="true" />{saving ? 'Сохраняем…' : 'Сохранить вложения'}</button><button type="button" class="button button--ghost" disabled={saving || preparing || resolvingConflict || disabled} on:click={resetDraft}><RotateCcw size={18} aria-hidden="true" />Отмена</button></div>{/if}
  {/if}
  {#if error}<p class="page-error" role="alert">{error}</p><button type="button" class="button button--soft" disabled={saving || preparing || resolvingConflict} on:click={() => refresh()}>Повторить загрузку</button>{/if}
  {#if liveError}<p class="media-note" role="status">{liveError}</p><button type="button" class="button button--soft" disabled={saving || preparing} on:click={loadScope}>Подключить обновления</button>{/if}
  {#if message}<p class="media-note" role="status">{message}</p>{/if}
</section>

<style>
  .work-media-panel { display: grid; gap: 10px; padding-block: 16px; min-width: 0; }
  h2 { margin: 0; font-size: 18px; }
  .media-actions { display: flex; flex-wrap: wrap; gap: 8px; }
  .media-actions .button { min-width: 0; font-size: 13px; }
  .media-note { color: var(--color-text-muted); font-size: 13px; margin: 0; overflow-wrap: anywhere; }
  .page-error { min-width: 0; overflow-wrap: anywhere; }
  .page-error .button { height: auto; min-height: 44px; white-space: normal; line-height: 1.4; padding-block: 8px; max-width: 100%; }
</style>
