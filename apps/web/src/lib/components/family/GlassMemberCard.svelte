<script lang="ts">
  import Pencil from '@lucide/svelte/icons/pencil';
  import Smile from '@lucide/svelte/icons/smile';
  import Copy from '@lucide/svelte/icons/copy';
  import UserPlus from '@lucide/svelte/icons/user-plus';
  import Check from '@lucide/svelte/icons/check';
  import type { FamilyMember } from '$lib/types/domain';

  export let member: FamilyMember;
  export let roleLabel: string;
  export let own = false;
  export let editable = false;
  export let invitable = false;
  export let childMode = false;
  export let busy = false;
  export let inviteLink = '';
  export let onedit: () => void;
  export let oninvite: () => void;
  export let onchild: () => void;
  export let oncopy: () => void;
</script>

<article class="family-glass-member" style={`--member-tone: var(--color-${member.colorKey ?? 'green'}); --member-soft: var(--color-${member.colorKey ?? 'green'}-soft)`}>
  <span class="family-glass-member__avatar" aria-hidden="true"><span>{member.displayName.charAt(0).toUpperCase()}</span></span>
  <div class="family-glass-member__identity">
    <h3>{member.displayName}</h3>
    <p>{roleLabel}{member.user ? ' · связан с аккаунтом' : ''}</p>
  </div>
  {#if editable}
    <button class="family-glass-control family-glass-member__edit" type="button" title="Изменить профиль" aria-label={`Изменить профиль ${member.displayName}`} on:click={onedit}><Pencil size={19} strokeWidth={1.8} aria-hidden="true" /></button>
  {/if}
  {#if own || childMode || invitable}
    <div class="family-glass-member__actions">
      {#if own}<span class="family-glass-member__badge"><Check size={14} aria-hidden="true" />Ваш профиль</span>{/if}
      {#if childMode}<button class="family-glass-control" type="button" on:click={onchild}><Smile size={19} strokeWidth={1.8} aria-hidden="true" />Детский режим</button>{/if}
      {#if invitable}<button class="family-glass-control" type="button" disabled={busy} on:click={oninvite}><UserPlus size={18} aria-hidden="true" />Пригласить</button>{/if}
    </div>
  {/if}
  {#if inviteLink}
    <div class="family-glass-member__invite"><p>{inviteLink}</p><button class="family-glass-control" type="button" title="Скопировать ссылку" aria-label="Скопировать ссылку" on:click={oncopy}><Copy size={18} aria-hidden="true" /></button></div>
  {/if}
</article>
