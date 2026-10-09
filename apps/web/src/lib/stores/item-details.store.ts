import { derived, writable } from 'svelte/store';

const selection = writable<{ itemId: string; occurrenceId?: string } | null>(null);
export const itemDetailsStore = {
  subscribe: derived(selection, value => value?.itemId ?? null).subscribe,
  set: (itemId: string | null) => selection.set(itemId ? { itemId } : null)
};
export const itemDetailsOccurrenceStore = derived(selection, value => value?.occurrenceId);
export function showItemDetails(itemId: string, occurrenceId?: string) {
  selection.set({ itemId, occurrenceId });
}
