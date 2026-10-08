import { afterEach, describe, expect, it, vi } from 'vitest';
import { getDialogTabStops, openComposerDialog } from './modal-focus';

afterEach(() => vi.unstubAllGlobals());

describe('Dialog tab stops', () => {
  it('includes a disclosure summary but excludes the controls inside its closed body', () => {
    const closed = { matches: (selector: string) => selector === 'details:not([open])', parentElement: null };
    const control = (tagName: string, parentElement: unknown) => ({ tagName, parentElement, tabIndex: 0, matches: () => false, closest: () => null, getClientRects: () => [{}] });
    const summary = control('SUMMARY', closed);
    const hiddenButton = control('BUTTON', closed);
    const closeButton = control('BUTTON', null);
    const dialog = { querySelectorAll: () => [closeButton, summary, hiddenButton] } as unknown as HTMLDialogElement;
    vi.stubGlobal('getComputedStyle', () => ({ visibility: 'visible' }));
    expect(getDialogTabStops(dialog)).toEqual([closeButton, summary]);
  });
  it('excludes disabled and CSS-hidden controls', () => {
    const button = { tabIndex: 0, parentElement: null, closest: () => null, getClientRects: () => [{}], matches: () => false };
    const disabled = { ...button, matches: () => true };
    const hidden = { ...button };
    vi.stubGlobal('getComputedStyle', (element: unknown) => ({ visibility: element === hidden ? 'hidden' : 'visible' }));
    const dialog = { querySelectorAll: () => [button, disabled, hidden] } as unknown as HTMLDialogElement;
    expect(getDialogTabStops(dialog)).toEqual([button]);
  });
});

describe('Modal scroll isolation', () => {
  it('locks the document until the last nested modal closes and restores its position', () => {
    const style = () => ({ overflow: '', overscrollBehavior: '', position: '', top: '', left: '', width: '' });
    const body = { style: style() };
    const root = { style: style() };
    const scrollTo = vi.fn();
    vi.stubGlobal('document', { body, documentElement: root, activeElement: null });
    vi.stubGlobal('window', { scrollX: 0, scrollY: 460, scrollTo });
    vi.stubGlobal('HTMLElement', class {});
    const createDialog = () => ({
      addEventListener: vi.fn(), removeEventListener: vi.fn(), showModal: vi.fn(), close: vi.fn(),
      querySelector: () => null, focus: vi.fn()
    }) as unknown as HTMLDialogElement;
    const closeFirst = openComposerDialog(createDialog(), vi.fn());
    const closeSecond = openComposerDialog(createDialog(), vi.fn());
    expect(body.style.position).toBe('fixed');
    expect(body.style.top).toBe('-460px');
    expect(root.style.overflow).toBe('hidden');
    closeFirst();
    expect(body.style.position).toBe('fixed');
    closeSecond();
    expect(body.style.position).toBe('');
    expect(root.style.overflow).toBe('');
    expect(scrollTo).toHaveBeenCalledWith(0, 460);
  });
  it('restores scrolling if the browser cannot open the dialog', () => {
    const body = { style: { position: '', overflow: '' } };
    const root = { style: { overflow: '' } };
    vi.stubGlobal('document', { body, documentElement: root, activeElement: null });
    vi.stubGlobal('window', { scrollX: 0, scrollY: 0, scrollTo: vi.fn() });
    vi.stubGlobal('HTMLElement', class {});
    const dialog = {
      addEventListener: vi.fn(), removeEventListener: vi.fn(), close: vi.fn(),
      showModal: () => { throw new Error('Cannot open'); }
    } as unknown as HTMLDialogElement;
    expect(() => openComposerDialog(dialog, vi.fn())).toThrow('Cannot open');
    expect(body.style.position).toBe('');
    expect(root.style.overflow).toBe('');
    expect(dialog.removeEventListener).toHaveBeenCalledTimes(4);
  });
});
