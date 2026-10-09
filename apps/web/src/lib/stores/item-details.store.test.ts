import { afterEach, expect, it } from 'vitest';
import { get } from 'svelte/store';
import { itemDetailsStore, itemDetailsOccurrenceStore, showItemDetails } from './item-details.store';

afterEach(() => itemDetailsStore.set(null));
it('keeps the selected occurrence when opening a repeating work item', () => {
  showItemDetails('i', 'o1');
  expect(get(itemDetailsStore)).toBe('i');
  expect(get(itemDetailsOccurrenceStore)).toBe('o1');
  showItemDetails('i', 'o2');
  expect(get(itemDetailsOccurrenceStore)).toBe('o2');
});
it('clears the previous date when a generic link or close is used', () => {
  showItemDetails('i', 'o1'); itemDetailsStore.set('i');
  expect(get(itemDetailsOccurrenceStore)).toBeUndefined();
  itemDetailsStore.set(null);
  expect(get(itemDetailsStore)).toBeNull();
});
