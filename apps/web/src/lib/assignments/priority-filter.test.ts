import { describe, expect, it } from 'vitest';
import { createTaskViewModels, filterWorkCards } from './assignments-view';
import { mapItemRecord } from '$lib/api/items.api';
import { mapOccurrenceRecord } from '$lib/api/occurrences.api';
describe('priority filters', () => {
  it('combines priority, status, member and case-insensitive title', () => {
    const items = ['high', 'normal', 'urgent'].map((priority, index) => mapItemRecord({ id: `i${index}`, family: 'f', kind: 'task', owner: 'm', priority }));
    const occurrences = items.map((item, index) => mapOccurrenceRecord({ id: `o${index}`, item: item.id, family: 'f', kind: 'task', title_snapshot: 'Школа', status: 'todo' }));
    const cards = createTaskViewModels({ items, occurrences, members: [] });
    expect(filterWorkCards(cards, 'open', 'm', 'ШКОЛА', 'high').map(card => card.itemId)).toEqual(['i0']);
    expect(filterWorkCards(cards, 'completed', 'm', '', 'high')).toEqual([]);
    expect(filterWorkCards(cards, 'all', '', '', 'all')).toHaveLength(3);
    expect(filterWorkCards(cards, 'all', 'other', '', 'high')).toEqual([]);
  });
});
