/** What has focus now, to give it back later; null when nothing does (focus is on the page body). */
export function focusedElement(): HTMLElement | null {
  const active = document.activeElement;
  return active instanceof HTMLElement && active !== document.body ? active : null;
}

/** Gives focus back to an element, while it is still on the page. */
export function refocus(element: HTMLElement | null): void {
  if (element?.isConnected) element.focus();
}
