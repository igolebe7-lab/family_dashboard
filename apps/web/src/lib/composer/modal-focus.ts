export function getDialogTabStops(dialog: HTMLDialogElement): HTMLElement[] {
  return Array.from(dialog.querySelectorAll<HTMLElement>(
    'button, input, select, textarea, a[href], summary, [tabindex]'
  )).filter(element => {
    if (element.tabIndex < 0 || element.matches(':disabled') || !element.getClientRects().length ||
      getComputedStyle(element).visibility === 'hidden' || element.closest('[inert]')) return false;
    // Closed disclosure contents can retain layout boxes, but cannot receive Tab focus.
    for (let parent = element.parentElement; parent && parent !== dialog; parent = parent.parentElement) {
      if (parent.matches('details:not([open])') && !(element.tagName === 'SUMMARY' && element.parentElement === parent)) return false;
    }
    return true;
  });
}

export function openComposerDialog(dialog: HTMLDialogElement, dismiss: () => void): () => void {
  const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const previousOverflow = document.body.style.overflow;
  const previousOverscroll = document.body.style.overscrollBehavior;
  document.body.style.overflow = 'hidden';
  document.body.style.overscrollBehavior = 'none';

  function cancel(event: Event): void {
    event.preventDefault();
    dismiss();
  }

  function trapTab(event: KeyboardEvent): void {
    if (event.key !== 'Tab') return;
    const controls = getDialogTabStops(dialog);
    const first = controls[0];
    const last = controls.at(-1);
    if (!first || !last) {
      event.preventDefault();
      dialog.focus();
    } else if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialog)) {
      event.preventDefault();
      first.focus();
    }
  }

  dialog.addEventListener('cancel', cancel);
  dialog.addEventListener('keydown', trapTab);
  dialog.showModal();
  dialog.querySelector<HTMLInputElement>('input')?.focus({ preventScroll: true });

  return () => {
    dialog.removeEventListener('cancel', cancel);
    dialog.removeEventListener('keydown', trapTab);
    dialog.close();
    document.body.style.overflow = previousOverflow;
    document.body.style.overscrollBehavior = previousOverscroll;
    if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
  };
}
