import { readable } from 'svelte/store';

export const desktopViewport = readable(false, set => {
  if (typeof window === 'undefined') return;
  const media = window.matchMedia('(min-width: 1024px)');
  const update = () => set(media.matches);
  update();
  media.addEventListener('change', update);
  return () => media.removeEventListener('change', update);
});
