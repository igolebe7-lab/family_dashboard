import { afterEach, describe, expect, it, vi } from 'vitest';
import { compactWorkspace, desktopViewport } from './viewport.store';

describe('single responsive shell viewport', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('tracks the shared desktop breakpoint and releases its listener', () => {
    const media = { matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() };
    const matchMedia = vi.fn().mockReturnValue(media);
    vi.stubGlobal('window', { matchMedia });
    const values: boolean[] = [];
    const unsubscribe = desktopViewport.subscribe(value => values.push(value));
    expect(matchMedia).toHaveBeenCalledWith('(min-width: 768px)');
    expect(values.at(-1)).toBe(true);
    media.matches = false;
    media.addEventListener.mock.calls[0][1]();
    expect(values.at(-1)).toBe(false);
    unsubscribe();
    expect(media.removeEventListener).toHaveBeenCalledWith('change', media.addEventListener.mock.calls[0][1]);
  });
  it('tracks the compact inspector range independently of input or window height', () => {
    const media = { matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() };
    const matchMedia = vi.fn().mockReturnValue(media);
    vi.stubGlobal('window', { matchMedia });
    const values: boolean[] = [];
    const unsubscribe = compactWorkspace.subscribe(value => values.push(value));
    expect(matchMedia).toHaveBeenCalledWith('(min-width: 768px) and (max-width: 1199px)');
    expect(values.at(-1)).toBe(true);
    media.matches = false; media.addEventListener.mock.calls[0][1]();
    expect(values.at(-1)).toBe(false);
    unsubscribe();
    expect(media.removeEventListener).toHaveBeenCalledOnce();
  });
});
