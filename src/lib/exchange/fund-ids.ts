/**
 * The wealth fund's account ids (fund.ts), client- and server-safe: notify.ts and the leaderboards skip these users
 * without a database lookup.
 */
export const FUND_USER_PREFIX = "treasury-fund-";

export const fundUserIdOf = (countryId: string) => `${FUND_USER_PREFIX}${countryId}`;

export const isFundUser = (userId: string) => userId.startsWith(FUND_USER_PREFIX);

export const countryIdOfFundUser = (userId: string): string | null =>
  isFundUser(userId) ? userId.slice(FUND_USER_PREFIX.length) || null : null;
