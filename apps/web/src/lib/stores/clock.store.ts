import { derived } from 'svelte/store';
import { displayTimezone } from './timezone.store';

// Local hour/date boundaries and foreground recovery; no background API polling.
export const displayClock = derived(displayTimezone, (timezone, set) => {
  let timer: ReturnType<typeof setTimeout>;
  function refresh() {
    const now = new Date();
    set(now);
    clearTimeout(timer);
    const minute = Number(new Intl.DateTimeFormat('en', { timeZone: timezone, minute: 'numeric' }).format(now));
    timer = setTimeout(refresh, (60 - minute) * 60000 - now.getSeconds() * 1000 - now.getMilliseconds() + 10);
  }
  function foreground() { if (document.visibilityState === 'visible') refresh(); }
  refresh();
  if (typeof window !== 'undefined') {
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', foreground);
  }
  return () => {
    clearTimeout(timer);
    if (typeof window !== 'undefined') {
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', foreground);
    }
  };
}, new Date());
