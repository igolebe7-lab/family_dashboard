import { COLLECTIONS } from '$lib/constants/collections';
import type { Family } from '$lib/types/domain';

import {
  asRecord,
  asString,
  getPocketBaseClient,
  requireCollectionMethod
} from './pocketbase';

export type CreateFamilyInput = {
  name: string;
  slug: string;
  timezone: string;
};

export type OwnerContext = {
  userId: string;
};

export async function createFamily(input: CreateFamilyInput, context: OwnerContext): Promise<Family> {
  const families = getPocketBaseClient().collection(COLLECTIONS.families);
  const create = requireCollectionMethod(families, 'create');
  const record = await create({
    name: input.name,
    slug: input.slug,
    timezone: input.timezone,
    owner_user: context.userId
  });

  return mapFamilyRecord(record);
}

export async function listFamilies(): Promise<Family[]> {
  const families = getPocketBaseClient().collection(COLLECTIONS.families);
  const getFullList = requireCollectionMethod(families, 'getFullList');
  const records = await getFullList({ sort: 'name' });

  return records.map(mapFamilyRecord);
}

export function mapFamilyRecord(value: unknown): Family {
  const record = asRecord(value);

  return {
    id: asString(record.id),
    name: asString(record.name),
    slug: asString(record.slug),
    timezone: asString(record.timezone),
    ownerUser: asString(record.owner_user)
  };
}
