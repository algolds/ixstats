/**
 * Metric loaders: a loader computes named numeric metrics for a user (scope "account") or for a
 * user's country (scope "country"), and an achievement `rule` reads them from `data.metrics`.
 * The service runs every loader of a scope once per evaluation, so each one is a few indexed
 * queries. Metrics that combine a count with a real-time floor are emitted as 0/1 flags (for
 * example `issues100Over12Weeks`), which keeps rules single-metric. Durations use real
 * `DateTime` fields and `time-buckets.ts`, never IxTime.
 *
 * To add a loader: create `metrics/<name>.ts` exporting a `MetricLoader`, then add one import
 * and one entry to `METRIC_LOADERS` below.
 */
import type { PrismaClient } from "@prisma/client";
import { EXECUTIVE_LOADERS } from "./executive";
import { PLATFORM_LOADERS } from "./platform";
import { POLITICS_LOADERS } from "./politics";

export type MetricScope = "account" | "country";

export interface MetricContext {
  db: PrismaClient;
  /** The Clerk id (`UserAchievement.userId`, ThinkPages, Policy, ... key on it). */
  clerkUserId: string;
  /** The internal `User.id` (`MyVault`, cards, forum and alliances key on it). */
  userId: string;
  /** The country being evaluated, null when the user has none. Account loaders must not depend on it. */
  countryId: string | null;
  /** One instant for the whole evaluation. */
  now: Date;
}

export interface MetricLoader {
  id: string;
  scope: MetricScope;
  /** Every key `load` returns; account-scope keys make the rules that read them account-level. */
  keys: readonly string[];
  load(ctx: MetricContext): Promise<Record<string, number>>;
}

export const METRIC_LOADERS: MetricLoader[] = [
  ...EXECUTIVE_LOADERS,
  ...POLITICS_LOADERS,
  ...PLATFORM_LOADERS,
];
