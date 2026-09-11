import { writable } from 'svelte/store';

import type { ActiveFamilyContext } from '$lib/api/pocketbase';
import type { Family, FamilyMember } from '$lib/types/domain';

export type FamilyStatus = 'idle' | 'loading' | 'ready' | 'error';

export type FamilyState = {
  status: FamilyStatus;
  families: Family[];
  members: FamilyMember[];
  activeFamily: Family | null;
  activeMember: FamilyMember | null;
  error: string | null;
};

const initialFamilyState: FamilyState = {
  status: 'idle',
  families: [],
  members: [],
  activeFamily: null,
  activeMember: null,
  error: null
};

export function createFamilyStore() {
  const store = writable<FamilyState>(initialFamilyState);
  let revision = 0;
  function update(updater: (state: FamilyState) => FamilyState): void {
    revision += 1;
    store.update(updater);
  }

  return {
    subscribe: store.subscribe,
    getRevision: () => revision,
    setLoading: () =>
      update(() => ({
        ...initialFamilyState,
        status: 'loading',
        error: null
      })),
    setFamilies: (families: Family[]) =>
      update((state) => {
        const activeFamily = families.find((family) => family.id === state.activeFamily?.id) ?? families[0] ?? null;
        const sameFamily = activeFamily?.id === state.activeFamily?.id;
        return {
          ...state, status: 'ready', families, activeFamily, error: null,
          members: sameFamily ? state.members : [],
          activeMember: sameFamily ? state.activeMember : null
        };
      }),
    setMembers: (members: FamilyMember[]) =>
      update((state) => {
        const available = members.filter((member) => member.active && member.family === state.activeFamily?.id);
        const activeMember = state.activeMember
          ? available.find((member) => member.id === state.activeMember?.id) ?? null
          : available[0] ?? null;
        return { ...state, status: 'ready', members: available, activeMember, error: null };
      }),
    setContext: (families: Family[], family: Family | null, members: FamilyMember[], member: FamilyMember | null) =>
      update(() => ({
        status: 'ready', families, activeFamily: family,
        members: members.filter((entry) => entry.active && entry.family === family?.id),
        activeMember: member?.active && member.family === family?.id ? member : null,
        error: null
      })),
    setActiveFamily: (family: Family | null) =>
      update((state) => ({
        ...state,
        activeFamily: family,
        members: state.members.filter((member) => member.family === family?.id),
        activeMember:
          family && state.activeMember?.family === family.id ? state.activeMember : null
      })),
    setActiveMember: (member: FamilyMember | null) =>
      update((state) => ({
        ...state,
        activeMember: member?.active && member.family === state.activeFamily?.id
          ? state.members.find((entry) => entry.id === member.id) ?? null : null
      })),
    setError: (error: string) =>
      update(() => ({
        ...initialFamilyState,
        status: 'error',
        error
      })),
    clear: () => update(() => initialFamilyState)
  };
}

export function getActiveFamilyContext(state: FamilyState): ActiveFamilyContext | null {
  if (state.status !== 'ready' || !state.activeFamily || !state.activeMember?.active ||
      state.activeMember.family !== state.activeFamily.id) return null;

  return {
    familyId: state.activeFamily.id,
    memberId: state.activeMember.id
  };
}

export const familyStore = createFamilyStore();
