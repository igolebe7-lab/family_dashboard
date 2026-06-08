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

  return {
    subscribe: store.subscribe,
    setLoading: () =>
      store.update((state) => ({
        ...state,
        status: 'loading',
        error: null
      })),
    setFamilies: (families: Family[]) =>
      store.update((state) => ({
        ...state,
        status: 'ready',
        families,
        activeFamily: state.activeFamily || families[0] || null,
        error: null
      })),
    setMembers: (members: FamilyMember[]) =>
      store.update((state) => ({
        ...state,
        status: 'ready',
        members,
        activeMember: state.activeMember || members[0] || null,
        error: null
      })),
    setActiveFamily: (family: Family | null) =>
      store.update((state) => ({
        ...state,
        activeFamily: family,
        activeMember:
          family && state.activeMember?.family === family.id ? state.activeMember : null
      })),
    setActiveMember: (member: FamilyMember | null) =>
      store.update((state) => ({
        ...state,
        activeMember: member
      })),
    setError: (error: string) =>
      store.update((state) => ({
        ...state,
        status: 'error',
        error
      })),
    clear: () => store.set(initialFamilyState)
  };
}

export function getActiveFamilyContext(state: FamilyState): ActiveFamilyContext | null {
  if (!state.activeFamily || !state.activeMember) return null;

  return {
    familyId: state.activeFamily.id,
    memberId: state.activeMember.id
  };
}

export const familyStore = createFamilyStore();
