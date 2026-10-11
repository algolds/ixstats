/**
 * Credit rewards for action-linked posts (docs/superpowers/specs/2026-10-10-thinkpages-forum-action-integration-design.md,
 * section 5): the first post that links an action pays a small flat reward, once per action ever, up to a per-country
 * daily cap. Pure names and rules shared by the reward transaction, the forum wrapper and the composers.
 */

/** The ledger `source` of the payout. */
export const ACTION_REWARD_SOURCE = "forum_action";
/** Social earnings: the user's social daily cap and the global earning switch apply. */
export const ACTION_REWARD_TYPE = "EARN_SOCIAL" as const;

/** What a post's write tells its composer: the credits the post earned. */
export interface ForumReward {
  amount: number;
}

/** The ledger's idempotency key: one payout per action, whichever post links it and however often it is relinked. */
export function actionRewardKey(activityId: string): string {
  return `forum_action:${activityId}`;
}

/** The advisory-lock key of a country's rewards: two posts at the daily cap queue behind each other. */
export function actionRewardLockKey(countryId: string): string {
  return `action-reward:${countryId}`;
}

/** Midnight UTC of `now`'s day: the daily cap's window. */
export function startOfUtcDay(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/** The composer's success line. */
export function rewardLine(amount: number): string {
  return `+${Math.round(amount * 100) / 100} IxC for posting your action`;
}
