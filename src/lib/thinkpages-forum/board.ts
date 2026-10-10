/**
 * The realm board's rules that the server enforces and the composer shows (docs/superpowers/specs/
 * 2026-10-10-thinkpages-realm-board-design.md). Pure, so the UI and the server read the same numbers.
 */

/** A board message is at most this many characters of plain text; longer ones continue in a thread. */
export const BOARD_MESSAGE_MAX = 1000;
export const BOARD_TOO_LONG =
  "Board messages are at most 1,000 characters. Continue in a thread for longer posts.";

/** The author may edit a board message for this long after posting. */
export const BOARD_EDIT_WINDOW_MS = 15 * 60_000;

export const BOARD_PAGE_SIZE = 50;
export const BOARD_MAX_PAGE_SIZE = 100;

/** The slow-mode choices an officer picks from (Off, 10s, 30s, 1m, 5m). */
export const SLOW_MODE_SECONDS = [0, 10, 30, 60, 300] as const;
export type SlowModeSeconds = (typeof SLOW_MODE_SECONDS)[number];

export function isSlowModeSeconds(value: number): value is SlowModeSeconds {
  return SLOW_MODE_SECONDS.some((seconds) => seconds === value);
}

export const slowModeNotice = (seconds: number): string => `You can post again in ${seconds}s`;

const EXCERPT_MAX = 140;

/** A short plain-text reference to a message, for "Replying to X: ..." lines. */
export function boardExcerpt(plainText: string): string {
  const text = plainText.trim().replace(/\s+/g, " ");
  const chars = [...text];
  return chars.length <= EXCERPT_MAX ? text : `${chars.slice(0, EXCERPT_MAX - 1).join("")}…`;
}

/** Whether a board message's plain text is within the cap (characters, not UTF-16 units). */
export const isWithinBoardCap = (plainText: string): boolean =>
  [...plainText].length <= BOARD_MESSAGE_MAX;
