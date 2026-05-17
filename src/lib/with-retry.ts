export type RetryStrategy = "exponential" | "linear" | "fixed";

export interface RetryOptions {
  maxAttempts: number;
  strategy: RetryStrategy;
  baseDelayMs: number;
  maxDelayMs: number;
  timeoutMs?: number;
  retryIf?: (error: Error) => boolean;
  onRetry?: (attempt: number, error: Error, delayMs: number) => void;
}

export interface AttemptResult<T> {
  success: boolean;
  value: T | undefined;
  error: Error | undefined;
  attempts: number;
}

const DEFAULT_OPTIONS: RetryOptions = {
  maxAttempts: 3,
  strategy: "exponential",
  baseDelayMs: 1000,
  maxDelayMs: 30000,
};

function calculateDelay(attempt: number, options: RetryOptions): number {
  const { strategy, baseDelayMs, maxDelayMs } = options;
  let delay: number;

  switch (strategy) {
    case "exponential":
      delay = baseDelayMs * Math.pow(2, attempt - 1);
      break;
    case "linear":
      delay = baseDelayMs * attempt;
      break;
    case "fixed":
      delay = baseDelayMs;
      break;
  }

  return Math.min(delay, maxDelayMs);
}

export async function attempt<T>(
  fn: (signal?: AbortSignal) => Promise<T>,
  options?: Partial<RetryOptions>
): Promise<AttemptResult<T>> {
  const opts: RetryOptions = { ...DEFAULT_OPTIONS, ...options };

  for (let i = 1; i <= opts.maxAttempts; i++) {
    let controller: AbortController | null = null;
    let signal: AbortSignal | undefined;

    if (opts.timeoutMs) {
      controller = new AbortController();
      signal = controller.signal;
      const timer = setTimeout(() => controller!.abort(), opts.timeoutMs);
      signal.addEventListener("abort", () => clearTimeout(timer), { once: true });
    }

    try {
      const value = await fn(signal);
      return { success: true, value, error: undefined, attempts: i };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));

      if (i === opts.maxAttempts) {
        return { success: false, value: undefined, error: err, attempts: i };
      }

      if (opts.retryIf && !opts.retryIf(err)) {
        return { success: false, value: undefined, error: err, attempts: i };
      }

      const delayMs = calculateDelay(i, opts);
      opts.onRetry?.(i, err, delayMs);

      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  return { success: false, value: undefined, error: new Error("Unreachable"), attempts: opts.maxAttempts };
}

export async function withRetry<T>(
  fn: (signal?: AbortSignal) => Promise<T>,
  options?: Partial<RetryOptions>
): Promise<T> {
  const result = await attempt(fn, options);
  if (result.success) return result.value!;
  throw result.error!;
}

export async function withRetrySafe<T>(
  fn: (signal?: AbortSignal) => Promise<T>,
  options?: Partial<RetryOptions>
): Promise<AttemptResult<T>> {
  return attempt(fn, options);
}
