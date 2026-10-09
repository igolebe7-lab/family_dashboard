import { derived } from 'svelte/store';
import { sessionStore } from './session.store';
import { resolveTimezone } from '$lib/utils/timezone';

export const displayTimezone = derived(sessionStore, session => resolveTimezone(session.user?.timezone));
