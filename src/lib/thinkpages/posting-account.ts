/**
 * Which of the viewer's ThinkPages accounts posts on behalf of their nation (a congratulation, a shared cultural
 * exchange): the nation's official account, then any of the viewer's accounts for that nation, then their personal
 * persona. `thinkpages.createPost` takes an account id, never a country id, and checks the caller owns it.
 */
export interface PostingAccountCandidate {
  id: string;
  countryId: string | null;
  accountType: string;
}

const OFFICIAL_TYPES = new Set(["government", "official"]);

export function pickPostingAccount(
  accounts: readonly PostingAccountCandidate[],
  countryId: string | null | undefined
): string | null {
  const forNation = countryId ? accounts.filter((a) => a.countryId === countryId) : [];
  const official = forNation.find((a) => OFFICIAL_TYPES.has(a.accountType.toLowerCase()));
  const personal = accounts.find((a) => a.countryId === null);
  return (official ?? forNation[0] ?? personal)?.id ?? null;
}
