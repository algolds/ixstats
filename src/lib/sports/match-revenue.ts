/**
 * MyClub match revenue (code audit SL-14).
 *
 * A club is paid once per completed match, when it collects:
 *   - each home match: ticket revenue plus the sponsor's base fee;
 *   - each win, home or away: the sponsor's win bonus.
 * `collectMatchRevenue` marks the matches it paid (`homeRevenueCollectedAt` /
 * `awayRevenueCollectedAt`), so collecting again pays nothing until new matches finish.
 */

interface RevenueTeam {
  id: string;
  stadiumCapacity: number;
  ticketPrice: number;
  popularity: number;
  sponsor: unknown;
}

interface RevenueMatch {
  id: string;
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number | null;
  awayScore: number | null;
}

interface MatchRevenue {
  homeMatches: number;
  wins: number;
  ticketRevenue: number;
  sponsorFees: number;
  winBonuses: number;
  total: number;
}

function sponsorTerms(sponsor: unknown): { baseFee: number; winBonus: number } {
  const s = (sponsor && typeof sponsor === "object" ? sponsor : {}) as Record<string, unknown>;
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : 0);
  return { baseFee: num(s.baseFee), winBonus: num(s.winBonus) };
}

/** Ticket revenue for one home match at the club's current stadium, prices and popularity. */
function ticketRevenuePerHomeMatch(team: RevenueTeam): number {
  return team.stadiumCapacity * team.ticketPrice * 0.6 * (team.popularity / 100);
}

/** What `team` earns from these completed, not-yet-collected matches. */
export function computeMatchRevenue(
  team: RevenueTeam,
  matches: readonly RevenueMatch[]
): MatchRevenue {
  const { baseFee, winBonus } = sponsorTerms(team.sponsor);
  let homeMatches = 0;
  let wins = 0;
  for (const m of matches) {
    const isHome = m.homeTeamId === team.id;
    if (!isHome && m.awayTeamId !== team.id) continue;
    if (isHome) homeMatches++;
    const own = isHome ? m.homeScore : m.awayScore;
    const other = isHome ? m.awayScore : m.homeScore;
    if (own !== null && other !== null && own > other) wins++;
  }
  const ticketRevenue = Math.round(homeMatches * ticketRevenuePerHomeMatch(team));
  const sponsorFees = homeMatches * baseFee;
  const winBonuses = wins * winBonus;
  return {
    homeMatches,
    wins,
    ticketRevenue,
    sponsorFees,
    winBonuses,
    total: ticketRevenue + sponsorFees + winBonuses,
  };
}
