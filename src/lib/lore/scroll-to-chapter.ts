/**
 * The Lore tab index's jump to a piece's chapter. A smooth scroll aims at where the page ends when it starts, but the
 * pieces it passes load on the way and the page grows, so it can end short of a late chapter (by thousands of pixels).
 * When the scroll ends away from the chapter, it scrolls again, a few times at most, and never once the reader scrolls
 * themselves or after a few seconds. Where `scrollend` is not supported it is the one scroll it always was.
 */

/** Tries after the first scroll. */
const MAX_SETTLES = 3;
/** How far from its scroll margin a chapter's top may sit and count as there. */
const TOLERANCE_PX = 2;
/** After this the jump is over, whatever happened. */
const GIVE_UP_MS = 4000;
/** The reader taking over the scroll. */
const READER_SCROLL = ["wheel", "touchstart", "keydown", "pointerdown"] as const;

/** Whether the chapter's top sits where `scrollIntoView` puts it: its scroll margin below the viewport's top. */
function atChapter(chapter: HTMLElement): boolean {
  const margin = Number.parseFloat(getComputedStyle(chapter).scrollMarginTop) || 0;
  return Math.abs(chapter.getBoundingClientRect().top - margin) <= TOLERANCE_PX;
}

export function scrollToChapter(chapter: HTMLElement, behavior: ScrollBehavior): void {
  let settles = 0;
  const done = () => {
    window.removeEventListener("scrollend", settle);
    for (const type of READER_SCROLL) window.removeEventListener(type, done);
    window.clearTimeout(timer);
  };
  function settle() {
    if (atChapter(chapter) || settles >= MAX_SETTLES) return done();
    settles += 1;
    chapter.scrollIntoView({ behavior, block: "start" });
  }
  const timer = window.setTimeout(done, GIVE_UP_MS);
  window.addEventListener("scrollend", settle);
  for (const type of READER_SCROLL) window.addEventListener(type, done, { passive: true });
  chapter.scrollIntoView({ behavior, block: "start" });
}
