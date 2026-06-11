import { get } from 'svelte/store';

import { listFamilies } from '$lib/api/families.api';
import { listMembersForFamily } from '$lib/api/members.api';
import type { ActiveFamilyContext } from '$lib/api/pocketbase';
import type { Family, FamilyMember } from '$lib/types/domain';
import { familyStore, getActiveFamilyContext, type createFamilyStore } from './family.store';

type FamilyStoreApi = ReturnType<typeof createFamilyStore>;

export type BootstrapFamilyDependencies = {
  listFamilies?: () => Promise<Family[]>;
  listMembersForFamily?: (familyId: string) => Promise<FamilyMember[]>;
  preferredUserId?: string;
};

export async function bootstrapFamilyContext(
  store: FamilyStoreApi = familyStore,
  dependencies: BootstrapFamilyDependencies = {}
): Promise<ActiveFamilyContext | null> {
  const loadFamilies = dependencies.listFamilies ?? listFamilies;
  const loadMembers = dependencies.listMembersForFamily ?? listMembersForFamily;

  store.setLoading();

  try {
    const families = await loadFamilies();
    store.setFamilies(families);

    const activeFamily = get(store).activeFamily;
    if (!activeFamily) {
      store.setMembers([]);
      return null;
    }

    const members = await loadMembers(activeFamily.id);
    store.setMembers(members);
    const preferredMember = dependencies.preferredUserId
      ? members.find((member) => member.user === dependencies.preferredUserId)
      : undefined;

    if (preferredMember) {
      store.setActiveMember(preferredMember);
    }

    return getActiveFamilyContext(get(store));
  } catch (error) {
    store.setError('Не удалось загрузить семейные данные');
    throw error;
  }
}
