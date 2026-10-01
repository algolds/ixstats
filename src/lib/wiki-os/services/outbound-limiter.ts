/**
 * outbound-limiter.ts — a cap on how much work the read path may send to MediaWiki.
 *
 * Anyone can ask for a page that does not exist, or for the authors of one, and each such request
 * costs an HTTP call to MediaWiki. A limiter bounds the calls in flight and (token bucket) the
 * calls per minute of one process; past either bound the task is not started and `ThrottledError`
 * says so, so the caller can answer "busy" instead of pretending the page is missing.
 */

export class ThrottledError extends Error {
  constructor(what: string) {
    super(`${what} is busy; try again shortly.`);
    this.name = "ThrottledError";
  }
}

export interface OutboundLimiterOptions {
  /** What is being limited, for the error message. */
  name: string;
  maxConcurrent: number;
  /** Calls per minute: the bucket holds this many tokens and refills at this rate. */
  perMinute: number;
  /** Clock, for tests. */
  now?: () => number;
}

export class OutboundLimiter {
  private running = 0;
  private tokens: number;
  private refilledAt: number;
  private readonly now: () => number;

  constructor(private readonly options: OutboundLimiterOptions) {
    this.now = options.now ?? (() => Date.now());
    this.tokens = options.perMinute;
    this.refilledAt = this.now();
  }

  /** Run `task` when a slot and a token are free; otherwise throw `ThrottledError` without queueing. */
  async run<T>(task: () => Promise<T>): Promise<T> {
    if (!this.tryAcquire()) throw new ThrottledError(this.options.name);
    try {
      return await task();
    } finally {
      this.running--;
    }
  }

  private tryAcquire(): boolean {
    this.refill();
    if (this.running >= this.options.maxConcurrent || this.tokens < 1) return false;
    this.tokens -= 1;
    this.running += 1;
    return true;
  }

  private refill(): void {
    const now = this.now();
    const earned = ((now - this.refilledAt) * this.options.perMinute) / 60_000;
    this.tokens = Math.min(this.options.perMinute, this.tokens + earned);
    this.refilledAt = now;
  }
}
