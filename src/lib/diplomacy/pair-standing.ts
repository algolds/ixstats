/**
 * Where a viewer's nation stands with one other nation: whether it already runs an embassy there, and
 * each foreign-policy act between them. The country actions menu reads it so each row says what is
 * already in place instead of offering an act the server would refuse as a duplicate.
 */

export type PairPolicy = "free_trade" | "military_alliance" | "sanction" | "embargo";

/** `open`: nothing yet · `proposed`: the viewer asked · `incoming`: the other nation asked · `active`: in force. */
export type PolicyState = "open" | "proposed" | "incoming" | "active";

interface PolicyRow {
  initiatorId: string;
  targetId: string;
  actionType: string;
  status: string;
}

interface EmbassyRow {
  hostCountryId: string;
  guestCountryId: string;
}

/** Free trade and alliances bind the pair either way round; sanctions and embargoes are one-way. */
const SYMMETRIC: ReadonlySet<string> = new Set(["free_trade", "military_alliance"]);

export function pairStanding(
  viewerId: string,
  targetId: string,
  policies: readonly PolicyRow[],
  embassies: readonly EmbassyRow[]
) {
  const between = (p: PolicyRow, type: PairPolicy) =>
    p.actionType === type &&
    ((p.initiatorId === viewerId && p.targetId === targetId) ||
      (SYMMETRIC.has(type) && p.initiatorId === targetId && p.targetId === viewerId));

  const policy = (type: PairPolicy): PolicyState => {
    const row = policies.find((p) => between(p, type));
    if (!row) return "open";
    if (row.status === "active") return "active";
    return row.initiatorId === viewerId ? "proposed" : "incoming";
  };

  return {
    /** One embassy per guest and host: the viewer's own embassy in the other nation. */
    hasEmbassy: embassies.some(
      (e) => e.guestCountryId === viewerId && e.hostCountryId === targetId
    ),
    policy,
  };
}
