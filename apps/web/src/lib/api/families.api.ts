import { COLLECTIONS } from '$lib/constants/collections';
import type { Family } from '$lib/types/domain';

import {
  asRecord,
  asString,
  getPocketBaseClient,
  requireCollectionMethod
} from './pocketbase';
import { createOwnerMember } from './members.api';

export type CreateFamilyInput = {
  name: string;
  slug: string;
  timezone: string;
};

export type OwnerContext = {
  userId: string;
};

export type CreateFamilyWithOwnerInput = {
  familyName: string;
  ownerName: string;
  ownerUserId: string;
  timezone: string;
  colorKey?: string;
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

export async function createFamilyWithOwner(input: CreateFamilyWithOwnerInput): Promise<{
  family: Family;
  member: Awaited<ReturnType<typeof createOwnerMember>>;
}> {
  const family = await createFamily(
    {
      name: input.familyName,
      slug: createFamilySlug(input.familyName),
      timezone: input.timezone
    },
    { userId: input.ownerUserId }
  );
  const member = await createOwnerMember(
    {
      displayName: input.ownerName,
      colorKey: input.colorKey ?? 'peach'
    },
    {
      familyId: family.id,
      userId: input.ownerUserId
    }
  );

  return { family, member };
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

function createFamilySlug(value: string): string {
  const transliterated = transliterateCyrillic(value);
  const base =
    transliterated
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/gi, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 32) || 'family';

  return `${base}-${Date.now().toString(36)}`;
}

function transliterateCyrillic(value: string): string {
  const map: Record<string, string> = {
    а: 'a',
    б: 'b',
    в: 'v',
    г: 'g',
    д: 'd',
    е: 'e',
    ё: 'e',
    ж: 'zh',
    з: 'z',
    и: 'i',
    й: 'y',
    к: 'k',
    л: 'l',
    м: 'm',
    н: 'n',
    о: 'o',
    п: 'p',
    р: 'r',
    с: 's',
    т: 't',
    у: 'u',
    ф: 'f',
    х: 'h',
    ц: 'c',
    ч: 'ch',
    ш: 'sh',
    щ: 'sch',
    ы: 'y',
    э: 'e',
    ю: 'yu',
    я: 'ya',
    ь: '',
    ъ: ''
  };

  return value
    .split('')
    .map((char) => map[char.toLowerCase()] ?? char)
    .join('');
}
