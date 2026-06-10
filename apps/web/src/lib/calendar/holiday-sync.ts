import type { DayAnnotation } from '$lib/types/domain';

export const HOLIDAY_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type NagerHoliday = {
  date: string;
  localName?: string;
  name?: string;
  countryCode: string;
  counties?: string[] | null;
  types?: string[];
};

export type HolidayStorage = Pick<Storage, 'getItem' | 'setItem'> | Map<string, string>;

export type LoadPublicHolidaysOptions = {
  countryCode: string;
  familyId: string;
  fetcher?: typeof fetch;
  now?: () => Date;
  storage?: HolidayStorage;
  year: number;
};

type HolidayCacheRecord = {
  fetchedAt: number;
  holidays: NagerHoliday[];
};

export function createHolidayCacheKey(year: number, countryCode: string): string {
  return `familytime:public-holidays:${countryCode.toUpperCase()}:${year}`;
}

export async function loadPublicHolidaysForYear(
  options: LoadPublicHolidaysOptions
): Promise<DayAnnotation[]> {
  const now = options.now?.() ?? new Date();
  const countryCode = options.countryCode.toUpperCase();
  const storage = options.storage;
  const cacheKey = createHolidayCacheKey(options.year, countryCode);
  const cached = storage ? readCache(storage, cacheKey) : null;

  if (cached && now.getTime() - cached.fetchedAt < HOLIDAY_CACHE_TTL_MS) {
    return cached.holidays.map((holiday) => mapNagerHolidayToDayAnnotation(holiday, options.familyId));
  }

  const fetcher = options.fetcher ?? fetch;
  const response = await fetcher(`https://date.nager.at/api/v3/PublicHolidays/${options.year}/${countryCode}`);
  if (!response.ok) throw new Error(`Failed to load public holidays: ${response.status}`);

  const holidays = (await response.json()) as NagerHoliday[];
  if (storage) {
    writeCache(storage, cacheKey, {
      fetchedAt: now.getTime(),
      holidays
    });
  }

  return holidays.map((holiday) => mapNagerHolidayToDayAnnotation(holiday, options.familyId));
}

export async function loadPublicHolidaysForYears(
  options: Omit<LoadPublicHolidaysOptions, 'year'> & { years: readonly number[] }
): Promise<DayAnnotation[]> {
  const annotationsByYear = await Promise.all(
    [...new Set(options.years)].map((year) =>
      loadPublicHolidaysForYear({
        ...options,
        year
      })
    )
  );

  return mergeDayAnnotations(annotationsByYear.flat(), []);
}

export function mapNagerHolidayToDayAnnotation(holiday: NagerHoliday, familyId: string): DayAnnotation {
  const [year, month, day] = holiday.date.split('-').map(Number);
  const countryCode = holiday.countryCode.toUpperCase();

  return {
    id: `holiday_${countryCode}_${holiday.date}`,
    family: familyId,
    kind: 'public_holiday',
    title: holiday.localName || holiday.name || 'Праздник',
    month,
    day,
    year,
    recurrence: 'one_time',
    color: 'gray',
    tone: 'system',
    visibility: 'family',
    source: 'nager_date',
    readonly: true,
    countryCode,
    regionCode: holiday.counties?.[0],
    sourceUid: `nager_date:${countryCode}:${holiday.date}`,
    sourceHash: createHolidaySourceHash(holiday),
    fetchedAt: new Date().toISOString()
  };
}

export function mergeDayAnnotations(
  primary: readonly DayAnnotation[],
  secondary: readonly DayAnnotation[]
): DayAnnotation[] {
  const seen = new Set<string>();
  const result: DayAnnotation[] = [];

  for (const annotation of [...primary, ...secondary]) {
    const key = annotation.sourceUid ?? annotation.id;
    if (seen.has(key)) continue;

    seen.add(key);
    result.push(annotation);
  }

  return result;
}

function createHolidaySourceHash(holiday: NagerHoliday): string {
  return [holiday.date, holiday.countryCode, holiday.localName, holiday.name, holiday.types?.join(',')]
    .filter(Boolean)
    .join('|');
}

function readCache(storage: HolidayStorage, key: string): HolidayCacheRecord | null {
  const raw = storage instanceof Map ? storage.get(key) : storage.getItem(key);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as HolidayCacheRecord;
    return typeof parsed.fetchedAt === 'number' && Array.isArray(parsed.holidays) ? parsed : null;
  } catch {
    return null;
  }
}

function writeCache(storage: HolidayStorage, key: string, record: HolidayCacheRecord): void {
  const value = JSON.stringify(record);
  if (storage instanceof Map) {
    storage.set(key, value);
    return;
  }

  storage.setItem(key, value);
}
