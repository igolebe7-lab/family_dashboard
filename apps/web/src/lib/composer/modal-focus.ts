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

const activeDialogs = new Set<HTMLDialogElement>();
let restoreScroll: (() => void) | undefined;

export function openComposerDialog(dialog: HTMLDialogElement, dismiss: () => void): () => void {
  const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  if (!activeDialogs.size) {
    const { scrollX, scrollY } = window;
    const body = document.body.style;
    const root = document.documentElement.style;
    const previousBody = { position: body.position, top: body.top, left: body.left, width: body.width, overflow: body.overflow, overscrollBehavior: body.overscrollBehavior };
    const previousRoot = { overflow: root.overflow, overscrollBehavior: root.overscrollBehavior };
    // overflow:hidden alone does not stop the Safari visual viewport from panning.
    Object.assign(body, { position: 'fixed', top: `${-scrollY}px`, left: `${-scrollX}px`, width: '100%', overflow: 'hidden', overscrollBehavior: 'none' });
    Object.assign(root, { overflow: 'hidden', overscrollBehavior: 'none' });
    restoreScroll = () => {
      Object.assign(body, previousBody);
      Object.assign(root, previousRoot);
      window.scrollTo(scrollX, scrollY);
    };
  }
  activeDialogs.add(dialog);
  let touchStart: { x: number; y: number } | undefined;
  function startTouch(event: TouchEvent) {
    const touch = event.touches[0];
    touchStart = event.touches.length === 1 && touch ? { x: touch.clientX, y: touch.clientY } : undefined;
  }
  function moveTouch(event: TouchEvent) {
    if (!touchStart || event.touches.length !== 1 || !event.cancelable) return;
    const touch = event.touches[0];
    const dx = touch.clientX - touchStart.x;
    const dy = touch.clientY - touchStart.y;
    touchStart = { x: touch.clientX, y: touch.clientY };
    if (Math.abs(dx) > Math.abs(dy)) { event.preventDefault(); return; }
    // Consume boundary gestures instead of forwarding them to the page behind the modal.
    for (const target of event.composedPath()) {
      if (!(target instanceof HTMLElement)) continue;
      const overflow = getComputedStyle(target).overflowY;
      if (/(auto|scroll)/.test(overflow) && target.scrollHeight > target.clientHeight &&
        ((dy < 0 && target.scrollTop + target.clientHeight < target.scrollHeight - 1) || (dy > 0 && target.scrollTop > 0))) return;
      if (target === dialog) break;
    }
    event.preventDefault();
  }

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
  dialog.addEventListener('touchstart', startTouch, { passive: true });
  dialog.addEventListener('touchmove', moveTouch, { passive: false });
  const cleanup = () => {
    dialog.removeEventListener('cancel', cancel);
    dialog.removeEventListener('keydown', trapTab);
    dialog.removeEventListener('touchstart', startTouch);
    dialog.removeEventListener('touchmove', moveTouch);
    dialog.close();
    activeDialogs.delete(dialog);
    if (!activeDialogs.size) { restoreScroll?.(); restoreScroll = undefined; }
    if (previousFocus?.isConnected && (!activeDialogs.size || [...activeDialogs].some(active => active.contains(previousFocus)))) previousFocus.focus({ preventScroll: true });
  };
  try {
    dialog.showModal();
    dialog.querySelector<HTMLInputElement>('input')?.focus({ preventScroll: true });
  } catch (error) {
    cleanup();
    throw error;
  }
  return cleanup;
}
