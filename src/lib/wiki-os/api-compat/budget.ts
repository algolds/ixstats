/**
 * budget.ts — how much a response may grow (plan 410), after MediaWiki's `$wgAPIMaxResultSize`.
 *
 * Modules that add page content (revision text) ask the budget before each item. Past the limit
 * the module stops, answers a `continue` for what is left and a warning, so one request cannot make
 * the server build a response of hundreds of megabytes (500 pages of 2 MB each).
 */

export const MAX_RESULT_BYTES = 8 * 1024 * 1024;

export const TRUNCATED_WARNING = `This result was truncated because it would otherwise be larger than the limit of ${MAX_RESULT_BYTES.toLocaleString("en-US")} bytes.`;

export class SizeBudget {
  private used = 0;

  constructor(private readonly limit = MAX_RESULT_BYTES) {}

  /**
   * Take `bytes` if they still fit. Whatever was added first always goes in, so a single huge item
   * is answered rather than refused forever (the module then has nothing left to continue with).
   */
  tryAdd(bytes: number): boolean {
    if (this.used > 0 && this.used + bytes > this.limit) return false;
    this.used += bytes;
    return true;
  }
}
