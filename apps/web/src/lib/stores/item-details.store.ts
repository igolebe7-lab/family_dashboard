import { writable } from 'svelte/store';

export const itemDetailsStore = writable<string | null>(null);
