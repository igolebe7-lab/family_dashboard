import { afterEach, describe, expect, it, vi } from 'vitest';
import { openComposerDialog } from '$lib/composer/modal-focus';
import { workspaceInspector } from './workspace-inspector';

vi.mock('$lib/composer/modal-focus', () => ({ openComposerDialog: vi.fn() }));
afterEach(() => vi.unstubAllGlobals());

describe('workspace inspector', () => {
  it('keeps content mounted while switching between a tablet modal and a desktop rail', () => {
    const cleanup = vi.fn();
    vi.mocked(openComposerDialog).mockReturnValue(cleanup);
    const dialog = { close: vi.fn(), show: vi.fn(), querySelectorAll: () => [] } as unknown as HTMLDialogElement;
    const options = { compact: true, open: false, onclose: vi.fn() };
    const action = workspaceInspector(dialog, options);
    expect(dialog.show).not.toHaveBeenCalled();
    action.update({ ...options, open: true });
    expect(openComposerDialog).toHaveBeenCalledWith(dialog, expect.any(Function));
    action.update({ ...options, compact: false, open: true });
    expect(cleanup).toHaveBeenCalledOnce();
    expect(dialog.show).toHaveBeenCalledOnce();
    action.update({ ...options, compact: false, open: false });
    expect(dialog.show).toHaveBeenCalledOnce();
    action.destroy();
    expect(dialog.close).toHaveBeenCalled();
  });
  it('closes the modal and uses the latest dismissal callback', () => {
    vi.mocked(openComposerDialog).mockClear();
    const cleanup = vi.fn();
    vi.mocked(openComposerDialog).mockReturnValue(cleanup);
    const dialog = { close: vi.fn(), show: vi.fn(), querySelectorAll: () => [] } as unknown as HTMLDialogElement;
    const first = vi.fn(), last = vi.fn();
    const action = workspaceInspector(dialog, { compact: true, open: true, onclose: first });
    action.update({ compact: true, open: true, onclose: last });
    vi.mocked(openComposerDialog).mock.calls[0][1]();
    expect(first).not.toHaveBeenCalled(); expect(last).toHaveBeenCalledOnce();
    action.update({ compact: true, open: false, onclose: last });
    expect(cleanup).toHaveBeenCalledOnce();
    action.destroy();
  });
  it('preserves focused text selection and inspector scroll on orientation changes', () => {
    class Field {
      selectionStart = 2; selectionEnd = 6; selectionDirection = 'forward';
      focus = vi.fn(); setSelectionRange = vi.fn();
    }
    const field = new Field(), scroller = { scrollTop: 180, scrollLeft: 0 };
    vi.stubGlobal('HTMLElement', Field);
    vi.stubGlobal('document', { activeElement: field });
    const cleanup = vi.fn(() => { scroller.scrollTop = 0; });
    vi.mocked(openComposerDialog).mockReturnValue(cleanup);
    const dialog = { contains: () => true, close: vi.fn(), show: vi.fn(() => { scroller.scrollTop = 0; }), querySelectorAll: () => [scroller] } as unknown as HTMLDialogElement;
    const options = { compact: true, open: true, onclose: vi.fn() };
    const action = workspaceInspector(dialog, options);
    field.focus.mockClear(); field.setSelectionRange.mockClear();
    action.update({ ...options, compact: false });
    expect(field.focus).toHaveBeenCalledWith({ preventScroll: true });
    expect(field.setSelectionRange).toHaveBeenCalledWith(2, 6, 'forward');
    expect(scroller.scrollTop).toBe(180);
    action.destroy();
  });
});
