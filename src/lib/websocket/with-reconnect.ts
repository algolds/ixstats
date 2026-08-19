export type ReconnectStrategy = "exponential" | "exponentialWithJitter" | "fixed";

export interface ReconnectOptions {
  maxAttempts: number;
  strategy: ReconnectStrategy;
  baseDelayMs: number;
  maxDelayMs: number;
  shouldReconnect?: (code: number, reason: string) => boolean;
  onAttempt?: (attempt: number, delayMs: number) => void;
  onGaveUp?: () => void;
}

export interface ReconnectController {
  readonly attempt: number;
  readonly isActive: boolean;
  schedule(): void;
  reset(): void;
  cancel(): void;
}

const DEFAULT_OPTIONS: ReconnectOptions = {
  maxAttempts: Infinity,
  strategy: "exponentialWithJitter",
  baseDelayMs: 1000,
  maxDelayMs: 30000,
};

function calculateDelay(attempt: number, options: ReconnectOptions): number {
  const { strategy, baseDelayMs, maxDelayMs } = options;
  let delay: number;

  switch (strategy) {
    case "exponential":
      delay = baseDelayMs * Math.pow(2, attempt - 1);
      break;
    case "exponentialWithJitter":
      delay = baseDelayMs * Math.pow(2, attempt - 1) + Math.random() * 1000;
      break;
    case "fixed":
      delay = baseDelayMs;
      break;
  }

  return Math.min(delay, maxDelayMs);
}

export function withReconnect(
  onReconnect: () => void | Promise<void>,
  options?: Partial<ReconnectOptions>
): ReconnectController {
  const opts: ReconnectOptions = { ...DEFAULT_OPTIONS, ...options };
  let currentAttempt = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let active = false;

  return {
    get attempt() {
      return currentAttempt;
    },

    get isActive() {
      return active;
    },

    schedule() {
      if (currentAttempt >= opts.maxAttempts) {
        opts.onGaveUp?.();
        return;
      }

      currentAttempt++;
      active = true;

      const delayMs = calculateDelay(currentAttempt, opts);
      opts.onAttempt?.(currentAttempt, delayMs);

      timer = setTimeout(async () => {
        try {
          await onReconnect();
        } catch {
          // Connect failed — the class itself handles retry via onclose
        }
      }, delayMs);
    },

    reset() {
      currentAttempt = 0;
    },

    cancel() {
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
      active = false;
    },
  };
}
