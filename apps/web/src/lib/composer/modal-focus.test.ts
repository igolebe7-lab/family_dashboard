import { afterEach, describe, expect, it, vi } from 'vitest';
import { getDialogTabStops } from './modal-focus';

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
