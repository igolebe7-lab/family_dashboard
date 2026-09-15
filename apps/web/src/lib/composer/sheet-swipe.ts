export function shouldDismissSheet(dy: number, dx: number, elapsed: number): boolean {
  return dy > Math.abs(dx) * 1.2 && (dy >= 90 || (dy >= 36 && dy / Math.max(elapsed, 1) >= 0.55));
}

export function sheetSwipe(handle: HTMLElement, dismiss: () => void) {
  const panel = handle.closest('dialog');
  let start: { id: number; x: number; y: number; time: number } | undefined;
  let suppressClick = false;
  function reset() {
    panel?.style.removeProperty('translate');
    start = undefined;
  }
  function down(event: PointerEvent) {
    if (!panel || !event.isPrimary || event.button !== 0 || !matchMedia('(max-width: 1023px)').matches) return;
    suppressClick = false;
    start = { id: event.pointerId, x: event.clientX, y: event.clientY, time: event.timeStamp };
    handle.setPointerCapture(event.pointerId);
  }
  function move(event: PointerEvent) {
    if (!start || event.pointerId !== start.id) return;
    const dy = event.clientY - start.y;
    if (Math.abs(dy) > 8 || Math.abs(event.clientX - start.x) > 8) suppressClick = true;
    if (panel) panel.style.translate = `0 ${Math.max(0, dy)}px`;
  }
  function up(event: PointerEvent) {
    if (!start || event.pointerId !== start.id) return;
    const close = shouldDismissSheet(event.clientY - start.y, event.clientX - start.x, event.timeStamp - start.time);
    reset();
    if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
    if (close) dismiss();
  }
  function click(event: MouseEvent) {
    // A short drag must not become an accidental click-to-close.
    if (suppressClick && event.detail !== 0) { event.preventDefault(); event.stopImmediatePropagation(); }
    suppressClick = false;
  }
  handle.addEventListener('pointerdown', down);
  handle.addEventListener('pointermove', move);
  handle.addEventListener('pointerup', up);
  handle.addEventListener('pointercancel', reset);
  handle.addEventListener('lostpointercapture', reset);
  handle.addEventListener('click', click, true);
  return {
    update(next: () => void) { dismiss = next; },
    destroy() {
      reset();
      handle.removeEventListener('pointerdown', down);
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', up);
      handle.removeEventListener('pointercancel', reset);
      handle.removeEventListener('lostpointercapture', reset);
      handle.removeEventListener('click', click, true);
    }
  };
}
