<script lang="ts">
  import Camera from '@lucide/svelte/icons/camera';
  import Trash2 from '@lucide/svelte/icons/trash-2';
  import X from '@lucide/svelte/icons/x';
  import Save from '@lucide/svelte/icons/save';
  import { onDestroy } from 'svelte';
  import { get } from 'svelte/store';
  import type { FamilyMember } from '$lib/types/domain';
  import type { ActiveFamilyContext } from '$lib/api/pocketbase';
  import { canEditMemberAvatar, updateMemberAvatar } from '$lib/api/members.api';
  import { sessionStore } from '$lib/stores/session.store';
  import { familyStore } from '$lib/stores/family.store';
  import { avatarCropGeometry, cropAvatarFile, loadAvatarSource } from '$lib/media/avatar-crop';
  import { openComposerDialog } from '$lib/composer/modal-focus';

  export let member: FamilyMember;
  export let context: ActiveFamilyContext;
  export let idPrefix = `avatar-${member.id}`;
  export let onupdated: ((member: FamilyMember) => void) | undefined = undefined;

  let picker: HTMLInputElement;
  let dialog: HTMLDialogElement;
  let image: HTMLImageElement | undefined;
  let sourceUrl = '';
  let zoom = 1;
  let offsetX = 0;
  let offsetY = 0;
  let busy = false;
  let loading = false;
  let error = '';
  let message = '';
  let revision = 0;
  let editToken: string | null = null;
  let closeDialog: (() => void) | undefined;
  let drag: { id: number; x: number; y: number } | undefined;
  const viewport = 240;

  $: crop = image ? avatarCropGeometry(image.naturalWidth, image.naturalHeight, viewport, zoom, offsetX, offsetY) : undefined;
  $: allowed = canEditMemberAvatar($familyStore.members, $sessionStore.user?.id, member);
  $: if (sourceUrl && (!allowed || editToken !== $sessionStore.token || context.familyId !== $familyStore.activeFamily?.id)) dismiss();

  function dismiss(): void {
    revision++;
    closeDialog?.(); closeDialog = undefined;
    if (sourceUrl) URL.revokeObjectURL(sourceUrl);
    sourceUrl = ''; image = undefined; drag = undefined;
  }

  async function choosePhoto(event: Event): Promise<void> {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0]; input.value = '';
    if (!file || busy || !allowed) return;
    dismiss();
    const attempt = ++revision;
    const token = $sessionStore.token;
    loading = true; error = ''; message = '';
    try {
      const source = await loadAvatarSource(file);
      if (attempt !== revision || token !== get(sessionStore).token || !getPermission()) {
        URL.revokeObjectURL(source.url); return;
      }
      image = source.image; sourceUrl = source.url; editToken = token;
      zoom = 1; offsetX = 0; offsetY = 0;
      closeDialog = openComposerDialog(dialog, dismiss);
    } catch (cause) {
      if (attempt === revision && token === get(sessionStore).token) {
        error = cause instanceof Error ? cause.message : 'Не удалось открыть фото.';
      }
    }
    finally { loading = false; }
  }

  function getPermission(): boolean {
    const family = get(familyStore);
    return family.activeFamily?.id === context.familyId &&
      canEditMemberAvatar(family.members, get(sessionStore).user?.id, member);
  }

  async function savePhoto(remove = false): Promise<void> {
    if (busy || !getPermission()) return;
    const token = get(sessionStore).token;
    const familyId = context.familyId;
    const target = member.id;
    const attempt = revision;
    busy = true; error = ''; message = '';
    try {
      const file = remove ? null : image && crop ? await cropAvatarFile(image, crop) : undefined;
      if (file === undefined || token !== get(sessionStore).token || !getPermission() || attempt !== revision) return;
      const updated = await updateMemberAvatar(target, file, context);
      if (token !== get(sessionStore).token || get(familyStore).activeFamily?.id !== familyId) return;
      familyStore.setMembers(get(familyStore).members.map(entry => entry.id === updated.id ? updated : entry));
      onupdated?.(updated);
      dismiss(); message = remove ? 'Фото удалено.' : 'Фото сохранено.';
    } catch {
      if (token === get(sessionStore).token && get(familyStore).activeFamily?.id === familyId && attempt === revision) {
        error = 'Не удалось сохранить фото. Проверьте подключение и права доступа.';
      }
    }
    finally { busy = false; }
  }

  function moveBy(dx: number, dy: number): void {
    if (!crop || busy) return;
    offsetX = crop.x - (viewport - crop.width) / 2 + dx;
    offsetY = crop.y - (viewport - crop.height) / 2 + dy;
  }

  function pointerDown(event: PointerEvent): void {
    if (busy || (event.pointerType === 'mouse' && event.button !== 0)) return;
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY };
  }
  function pointerMove(event: PointerEvent): void {
    if (!drag || drag.id !== event.pointerId) return;
    moveBy(event.clientX - drag.x, event.clientY - drag.y);
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY };
  }
  function keyMove(event: KeyboardEvent): void {
    const moves: Record<string, [number, number]> = { ArrowLeft: [-8, 0], ArrowRight: [8, 0], ArrowUp: [0, -8], ArrowDown: [0, 8] };
    if (!moves[event.key]) return;
    event.preventDefault(); moveBy(...moves[event.key]);
  }
  function setZoom(value: number): void {
    const ratio = value / zoom;
    if (crop) {
      offsetX = (crop.x - (viewport - crop.width) / 2) * ratio;
      offsetY = (crop.y - (viewport - crop.height) / 2) * ratio;
    }
    zoom = value;
  }
  onDestroy(dismiss);
</script>

<div class="avatar-editor" aria-busy={busy || loading}>
  <input bind:this={picker} type="file" accept="image/jpeg,image/png,image/webp" aria-label={`Фото профиля ${member.displayName}`} on:change={choosePhoto} hidden />
  <button class="family-glass-control" type="button" disabled={busy || loading || !allowed} title="Изменить фото" aria-label={`Изменить фото ${member.displayName}`} on:click={() => picker.click()}><Camera size={19} aria-hidden="true" /></button>
  {#if member.avatar}<button class="family-glass-control" type="button" disabled={busy || loading || !allowed} title="Удалить фото" aria-label={`Удалить фото ${member.displayName}`} on:click={() => savePhoto(true)}><Trash2 size={18} aria-hidden="true" /></button>{/if}
  {#if loading}<span role="status">Готовим фото…</span>{/if}
  {#if error && !sourceUrl}<span class="avatar-editor__error" role="alert">{error}</span>{/if}
  {#if message}<span role="status">{message}</span>{/if}
</div>

<dialog bind:this={dialog} class="avatar-dialog" aria-labelledby={`${idPrefix}-title`}>
  <header><h2 id={`${idPrefix}-title`}>Фото профиля</h2><button class="family-glass-control" type="button" title="Закрыть" aria-label="Закрыть редактор фото" on:click={dismiss}><X size={20} aria-hidden="true" /></button></header>
  {#if sourceUrl && crop}
    <button class="avatar-crop" type="button" aria-label="Положение фото" disabled={busy}
      style={`--crop-tone: ${member.colorHex || `var(--color-${member.colorKey || 'blue'})`}`}
      on:pointerdown={pointerDown} on:pointermove={pointerMove} on:pointerup={() => drag = undefined} on:pointercancel={() => drag = undefined} on:lostpointercapture={() => drag = undefined} on:keydown={keyMove}>
      <img src={sourceUrl} alt="" draggable="false" style={`width:${crop.width}px; height:${crop.height}px; transform:translate(${crop.x}px,${crop.y}px)`} />
    </button>
    <label class="avatar-zoom" for={`${idPrefix}-zoom`}>Масштаб <input id={`${idPrefix}-zoom`} type="range" min="1" max="4" step="0.01" value={zoom} disabled={busy} on:input={event => setZoom(Number(event.currentTarget.value))} /></label>
  {/if}
  {#if error && sourceUrl}<p class="avatar-editor__error" role="alert">{error}</p>{/if}
  <footer><button class="button button--ghost" type="button" on:click={dismiss}>Отмена</button><button class="button button--primary" type="button" disabled={busy || !image} on:click={() => savePhoto()}><Save size={18} aria-hidden="true" />{busy ? 'Сохраняем' : 'Сохранить'}</button></footer>
</dialog>

<style>
  .avatar-editor { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; font-size: 13px; }
  .avatar-editor > button, .avatar-dialog header button { min-width: 44px; min-height: 44px; }
  .avatar-editor__error { color: var(--color-danger, var(--color-text)); }
  .avatar-dialog { box-sizing: border-box; width: min(420px, calc(100% - 24px)); max-height: calc(100dvh - 32px); padding: 20px; overflow-y: auto; border: 1px solid var(--color-border); border-radius: 24px; background: var(--color-surface); color: var(--color-text); }
  .avatar-dialog::backdrop { background: rgb(0 0 0 / 0.5); }
  header, footer { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  h2 { margin: 0; font-size: 20px; }
  footer { margin-top: 20px; flex-wrap: wrap; }
  .avatar-crop { position: relative; box-sizing: border-box; display: block; width: 240px; height: 240px; margin: 20px auto; padding: 0; border: 0; border-radius: 50%; overflow: hidden; touch-action: none; cursor: grab; background: var(--color-surface); box-shadow: 0 0 0 4px var(--crop-tone); }
  .avatar-crop:active { cursor: grabbing; }
  .avatar-crop img { position: absolute; inset: 0 auto auto 0; max-width: none; pointer-events: none; user-select: none; }
  .avatar-zoom { display: grid; gap: 8px; font-size: 14px; }
  .avatar-zoom input { width: 100%; min-height: 44px; accent-color: var(--color-primary); }
  button:focus-visible, input:focus-visible { outline: 3px solid var(--color-primary); outline-offset: 5px; }
</style>
