/**
 * In-process, minute-granular cron scheduler (plan 330). Used only by cron-runner.mjs.
 *
 * Patterns are 5-field UTC cron: minute hour day-of-month month day-of-week. Each field is a
 * comma list of `*`, `n` or `a-b`, each optionally with `/step`. Cross-process single-flight is
 * NOT handled here — cron-runner wraps every task in the advisory job lock.
 *
 * Do not use Bun's built-in cron API: it registers an OS crontab entry, not an in-process job.
 */

type FieldBounds = readonly [number, number];

/** minute, hour, day-of-month, month, day-of-week (0 = Sunday). */
const FIELD_BOUNDS: readonly FieldBounds[] = [
  [0, 59],
  [0, 23],
  [1, 31],
  [1, 12],
  [0, 6],
];

const FIELD_PATTERN = /^(\*|\d+(-\d+)?)(\/\d+)?(,(\*|\d+(-\d+)?)(\/\d+)?)*$/;
const MINUTE_MS = 60_000;
const TICK_SLACK_MS = 250;

export function isValidCronPattern(pattern: string): boolean {
  const fields = pattern.trim().split(/\s+/);
  return fields.length === FIELD_BOUNDS.length && fields.every((f) => FIELD_PATTERN.test(f));
}

function partRange(base: string, bounds: FieldBounds, hasStep: boolean): FieldBounds {
  if (base === "*") return bounds;
  const [start = "", end] = base.split("-");
  const lo = Number(start);
  if (end !== undefined) return [lo, Number(end)];
  // "n/step" runs from n to the field maximum, as in standard cron.
  return [lo, hasStep ? bounds[1] : lo];
}

function matchesPart(part: string, value: number, bounds: FieldBounds): boolean {
  const [base = "", stepText] = part.split("/");
  const step = stepText === undefined ? 1 : Number(stepText);
  const [lo, hi] = partRange(base, bounds, stepText !== undefined);
  return step > 0 && value >= lo && value <= hi && (value - lo) % step === 0;
}

export function matchesCron(pattern: string, date: Date): boolean {
  if (!isValidCronPattern(pattern)) return false;
  const values = [
    date.getUTCMinutes(),
    date.getUTCHours(),
    date.getUTCDate(),
    date.getUTCMonth() + 1,
    date.getUTCDay(),
  ];
  return pattern
    .trim()
    .split(/\s+/)
    .every((field, i) =>
      field.split(",").some((part) => matchesPart(part, values[i], FIELD_BOUNDS[i]))
    );
}

export interface ScheduledTask {
  name: string;
  schedule: string;
  run: () => Promise<void>;
}

interface SchedulerHandle {
  stop: () => void;
}

type Timer = ReturnType<typeof setTimeout>;

interface SchedulerDeps {
  now?: () => number;
  setTimer?: (fn: () => void, ms: number) => Timer;
  clearTimer?: (t: Timer) => void;
  log?: (msg: string) => void;
}

/**
 * Fires each task whose schedule matches the current UTC minute, once per minute. A task that
 * is still running in this process is not started again; a failing task is logged and never
 * affects the others.
 */
export function startScheduler(
  tasks: readonly ScheduledTask[],
  deps: SchedulerDeps = {}
): SchedulerHandle {
  const now = deps.now ?? Date.now;
  const setTimer = deps.setTimer ?? ((fn: () => void, ms: number) => setTimeout(fn, ms));
  const clearTimer = deps.clearTimer ?? ((t: Timer) => clearTimeout(t));
  const log = deps.log ?? ((msg: string) => console.log(msg));
  const running = new Set<string>();
  const lastFiredMinute = new Map<string, number>();
  let timer: Timer | undefined;
  let stopped = false;

  const runTask = async (task: ScheduledTask): Promise<void> => {
    running.add(task.name);
    try {
      await task.run();
    } catch (error) {
      const detail = error instanceof Error ? (error.stack ?? error.message) : String(error);
      log(`[Cron] ${task.name} failed: ${detail}`);
    } finally {
      running.delete(task.name);
    }
  };

  const tick = (): void => {
    const minuteMs = Math.floor(now() / MINUTE_MS) * MINUTE_MS;
    const minute = new Date(minuteMs);
    for (const task of tasks) {
      if (lastFiredMinute.get(task.name) === minuteMs || !matchesCron(task.schedule, minute)) {
        continue;
      }
      lastFiredMinute.set(task.name, minuteMs);
      if (running.has(task.name)) {
        log(`[Cron] ${task.name} still running — skipped this minute`);
        continue;
      }
      void runTask(task);
    }
    arm();
  };

  const arm = (): void => {
    if (stopped) return;
    timer = setTimer(tick, MINUTE_MS - (now() % MINUTE_MS) + TICK_SLACK_MS);
  };

  arm();
  return {
    stop: () => {
      stopped = true;
      if (timer !== undefined) clearTimer(timer);
    },
  };
}
