/**
 * Closes a menu or popover when the person turns elsewhere (milestone 11,
 * owner feedback: the dots menu stayed open): a press outside it, the
 * keyboard moving outside it, and the window losing focus. A click inside
 * a web page never reaches the shell as a press, but it does move the
 * focus to that page's webview, so the focus check covers it.
 *
 * Returns a function that stops watching.
 */
export function watchDismiss(
  host: HTMLElement,
  isOpen: () => boolean,
  close: () => void,
  /** Presses that are not "elsewhere" (the button that opens and closes it). */
  ignore: (path: EventTarget[]) => boolean = () => false,
): () => void {
  const outside = (e: Event) => {
    const path = e.composedPath();
    return !path.includes(host) && !ignore(path);
  };
  const onPointer = (e: PointerEvent) => {
    if (isOpen() && outside(e)) close();
  };
  const onFocus = (e: FocusEvent) => {
    if (isOpen() && outside(e)) close();
  };
  const onBlur = () => {
    if (isOpen()) close();
  };
  document.addEventListener('pointerdown', onPointer, true);
  document.addEventListener('focusin', onFocus, true);
  window.addEventListener('blur', onBlur);
  return () => {
    document.removeEventListener('pointerdown', onPointer, true);
    document.removeEventListener('focusin', onFocus, true);
    window.removeEventListener('blur', onBlur);
  };
}
