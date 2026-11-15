/** The parts of a mouse event that say whether a link click is a plain one. */
interface ClickLike {
  button: number;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  defaultPrevented: boolean;
}

/**
 * A plain primary click, which a link may take over (to open a sheet instead of navigating). Anything else
 * (Cmd/Ctrl/Shift/Alt, a middle click, a handler that already took it) keeps the browser's own link behaviour,
 * so a new tab or window still reaches the page.
 */
export function isPlainClick(e: ClickLike): boolean {
  return (
    !e.defaultPrevented && e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey
  );
}
