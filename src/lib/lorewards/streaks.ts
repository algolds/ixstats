const DAY_MS = 24 * 60 * 60 * 1000;
const daysBetween = (from: string, to: string) =>
  (new Date(to).getTime() - new Date(from).getTime()) / DAY_MS;

/** The current and longest runs of consecutive daily-win days; the current one is 0 once a day goes by without a win. */
export function calculateStreaks(winDates: string[]): { current: number; longest: number } {
  if (winDates.length === 0) return { current: 0, longest: 0 };

  const sorted = [...winDates].sort();
  let longest = 1;
  let run = 1; // after the loop: the consecutive-day run ending at the last win
  for (let i = 1; i < sorted.length; i++) {
    run = daysBetween(sorted[i - 1]!, sorted[i]!) === 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
  }

  const today = new Date().toISOString().slice(0, 10);
  const streakBroken = daysBetween(sorted[sorted.length - 1]!, today) > 1;
  return { current: streakBroken ? 0 : run, longest };
}
