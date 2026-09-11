import { describe, expect, it, vi, afterEach } from 'vitest';
import { buildItemSearchFilter, searchItems } from './search.api';
import { resetPocketBaseClient, setPocketBaseClient } from './pocketbase';

afterEach(resetPocketBaseClient);

describe('family item search', () => {
  it('keeps archived records discoverable without mixing them into active results', () => {
    expect(buildItemSearchFilter('a', '', 'all', true)).toBe('family = "a" && archived = true');
    expect(buildItemSearchFilter('a', '', 'all')).toBe('family = "a" && archived = false');
  });
  it('escapes search text without allowing it to alter family scope', () => {
    const filter = buildItemSearchFilter('family-a', '" || family != ""', 'task');
    expect(filter).toContain('family = "family-a" && archived = false');
    expect(filter).toContain('search_text ~ "\\""');
    expect(filter).toContain('kind = "task"');
  });

  it('paginates with active member permissions and never searches without a family', async () => {
    const getList = vi.fn().mockResolvedValue({ items: [], totalPages: 3, totalItems: 75 });
    setPocketBaseClient({
      authStore: { token: '', record: null, isValid: false, clear() {} },
      collection: () => ({ getList })
    });
    expect(await searchItems({ familyId: 'a', memberId: 'm' }, '  школа  ', 'all', 2))
      .toEqual({ items: [], totalPages: 3, totalItems: 75 });
    expect(getList).toHaveBeenCalledWith(2, 30, expect.objectContaining({
      headers: { 'X-Family-Member-Id': 'm' },
      filter: 'family = "a" && archived = false && search_text ~ "школа"'
    }));
    await expect(searchItems({ familyId: '', memberId: 'm' }, '')).rejects.toThrow();
  });
  it('normalizes Russian case, yo, whitespace and repeated words', () => {
    expect(buildItemSearchFilter('a', '  ЁЛКА   Парк\nёлка ', 'all')).toBe(
      'family = "a" && archived = false && search_text ~ "елка" && search_text ~ "парк"'
    );
  });
});
