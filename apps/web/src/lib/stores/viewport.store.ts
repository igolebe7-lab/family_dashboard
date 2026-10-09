import { readable } from 'svelte/store';

function mediaStore(query: string) {
  return readable(false, set => {
    if (typeof window === 'undefined') return;
    const media = window.matchMedia(query);
    const update = () => set(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  });
}

// Match CSS: tablets use the workspace; narrow multitasking windows remain phone-sized.
export const desktopViewport = mediaStore('(min-width: 768px)');
export const compactWorkspace = mediaStore('(min-width: 768px) and (max-width: 1199px)');
