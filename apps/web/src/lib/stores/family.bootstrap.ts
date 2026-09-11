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

  const preferredFamilyId = get(store).activeFamily?.id;
  store.setLoading();
  const revision = store.getRevision();
  const isCurrent = () => store.getRevision() === revision;

  try {
    const families = await loadFamilies();
    if (!isCurrent()) return null;

    const activeFamily = families.find((family) => family.id === preferredFamilyId) ?? families[0] ?? null;
    if (!activeFamily) {
      store.setContext(families, null, [], null);
      return null;
    }

    const members = await loadMembers(activeFamily.id);
    if (!isCurrent()) return null;
    const available = members.filter((member) => member.active && member.family === activeFamily.id);
    const preferredMember = dependencies.preferredUserId
      ? available.find((member) => member.user === dependencies.preferredUserId)
      : available[0];
    store.setContext(families, activeFamily, available, preferredMember ?? null);

    return getActiveFamilyContext(get(store));
  } catch (error) {
    if (!isCurrent()) return null;
    store.setError('Не удалось загрузить семейные данные');
    throw error;
  }
}
