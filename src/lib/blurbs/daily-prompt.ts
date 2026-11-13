const DAY_MS = 86_400_000;

/**
 * Today's blurb prompt: the same one for everyone for the whole UTC day, so a "daily" blurb is a shared
 * question and the answers beside it are about the same thing.
 * ponytail: rotation is day % count over prompts sorted by id, so publishing or closing a prompt can switch
 * the current day's pick; store a scheduled prompt per day if that ever matters.
 */
export function pickDailyPrompt<T extends { id: string }>(
  prompts: readonly T[],
  now: Date
): T | null {
  if (prompts.length === 0) return null;
  const sorted = [...prompts].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const day = Math.floor(now.getTime() / DAY_MS);
  return sorted[day % sorted.length] ?? null;
}
