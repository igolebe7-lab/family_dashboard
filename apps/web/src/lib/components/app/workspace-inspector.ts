import { openComposerDialog } from '$lib/composer/modal-focus';

type InspectorOptions = { compact: boolean; open: boolean; onclose: () => void };

// Keep one mounted inspector, including unsaved forms, across orientation changes.
export function workspaceInspector(dialog: HTMLDialogElement, options: InspectorOptions) {
  let mode = '';
  let cleanup: (() => void) | undefined;
  function update(next: InspectorOptions) {
    options = next;
    const nextMode = next.compact ? (next.open ? 'modal' : 'closed') : 'inline';
    if (mode === nextMode) return;
    const active = typeof document !== 'undefined' ? document.activeElement : null;
    const focus = typeof HTMLElement !== 'undefined' && active instanceof HTMLElement && dialog.contains(active) ? active : null;
    const control = focus && 'selectionStart' in focus ? focus as HTMLInputElement | HTMLTextAreaElement : null;
    const selection = control?.selectionStart != null ? [control.selectionStart, control.selectionEnd, control.selectionDirection] as const : null;
    const scroll = Array.from(dialog.querySelectorAll<HTMLElement>('[data-inspector-scroll]')).map(element => ({ element, top: element.scrollTop, left: element.scrollLeft }));
    cleanup?.(); cleanup = undefined;
    dialog.close();
    mode = nextMode;
    if (mode === 'modal') cleanup = openComposerDialog(dialog, () => options.onclose());
    else if (mode === 'inline') dialog.show();
    if (mode !== 'closed') {
      focus?.focus({ preventScroll: true });
      if (control && selection) control.setSelectionRange(selection[0], selection[1], selection[2] ?? undefined);
      for (const { element, top, left } of scroll) { element.scrollTop = top; element.scrollLeft = left; }
    }
  }
  update(options);
  return { update, destroy() { cleanup?.(); dialog.close(); } };
}
