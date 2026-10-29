/**
 * Issue cadence for the generation cron (owner decision 5: an active nation averages 2-3 new issues a week, under the
 * session and weekly caps). The cron evaluates every owned nation every 30 minutes; unpaced, each run handed out up to
 * the session cap, so a nation's issues arrived in bursts until cooldowns ran its eligible templates dry.
 *
 * Paced, a nation gets its next issue once a gap has passed since its last one (any source: templates, the staffing
 * shortage, policy and intent spawns). The gap is drawn from an exponential distribution (mean MEAN_ISSUE_GAP_IX_DAYS,
 * never below MIN_ISSUE_GAP_IX_DAYS) seeded by the nation and its last issue's time, so it needs no stored state and
 * barely depends on how often the cron runs (a gap only rounds up to the next run), and a cron that was down resumes
 * with one issue, not a burst. When the gap is up, one triggered template is picked, weighted by its
 * probability (urgency, intent boost, NPC personality). When nothing triggers, the nation stays due until something
 * does.
 *
 * The week here is the caps' week: 7 IxDays (3.5 real days at IxTime's 2x).
 */

const IX_DAY_MS = 24 * 60 * 60 * 1000;

/** Mean IxDays between a nation's issues: tuned by plans/mycountry-stress tuning-T cadence simulation. */
export const MEAN_ISSUE_GAP_IX_DAYS = 2.2;
/** No two paced issues closer than this. */
export const MIN_ISSUE_GAP_IX_DAYS = 0.5;

/** A deterministic number in (0, 1) from a string (FNV-1a, then a murmur finaliser). */
export function hashUnit(key: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return ((h >>> 0) + 0.5) / 4294967296;
}

/** IxTime ms between a nation's issue at `lastIxTime` and its next paced one. */
export function issueGapMs(countryId: string, lastIxTime: number): number {
  const u = hashUnit(`${countryId}:${lastIxTime}`);
  const days = MIN_ISSUE_GAP_IX_DAYS + (MEAN_ISSUE_GAP_IX_DAYS - MIN_ISSUE_GAP_IX_DAYS) * -Math.log(u);
  return days * IX_DAY_MS;
}

/** Whether the nation is due its next paced issue at `now` (always, before its first issue). */
export function issueDue(
  countryId: string,
  recentIssues: ReadonlyArray<{ createdIxTime: number }>,
  now: number
): boolean {
  if (recentIssues.length === 0) return true;
  const last = Math.max(...recentIssues.map((i) => i.createdIxTime));
  return now - last >= issueGapMs(countryId, last);
}

/** Up to `n` candidates without replacement, each drawn with chance proportional to its probability. */
export function pickWeighted<T extends { probability: number }>(
  candidates: readonly T[],
  n: number,
  random: () => number = Math.random
): T[] {
  // Efraimidis-Spirakis: key = u^(1/w); the n largest keys are a weighted sample.
  return candidates
    .filter((c) => c.probability > 0)
    .map((c) => ({ c, key: Math.pow(random(), 1 / c.probability) }))
    .sort((a, b) => b.key - a.key)
    .slice(0, Math.max(0, n))
    .map((x) => x.c);
}

/** The paced pick for one evaluation: one weighted candidate when the nation is due, otherwise none. */
export function selectPacedCandidates<T extends { probability: number }>(
  candidates: readonly T[],
  recentIssues: ReadonlyArray<{ createdIxTime: number }>,
  countryId: string,
  now: number,
  maxIssues: number,
  random: () => number = Math.random
): T[] {
  if (maxIssues < 1 || !issueDue(countryId, recentIssues, now)) return [];
  return pickWeighted(candidates, 1, random);
}
