/**
 * Bans, warnings and appeals of member `u_m` for the appeal and standing suites, around a fixed NOW. The active
 * points (2 + 3 + 2 = 7) stand behind the automatic site ban `b_auto` (tier 5).
 */
import { DAY_MS } from "~/lib/thinkpages-forum/moderation-policy";
import type { Row } from "~/tests/helpers/forum-store-fake";

export const NOW = new Date("2026-10-09T12:00:00Z");
export const days = (n: number) => new Date(NOW.getTime() + n * DAY_MS);

export const ban = (id: string, extra: Row = {}): Row => ({
  id,
  userId: "u_m",
  scope: "realm",
  scopeId: "r_eurth",
  reason: "Spam",
  issuedBy: "u_eurth",
  expiresAt: days(5),
  auto: false,
  autoTier: null,
  liftedAt: null,
  liftedBy: null,
  createdAt: days(-1),
  ...extra,
});

export const warning = (id: string, extra: Row = {}): Row => ({
  id,
  userId: "u_m",
  issuedBy: "u_eurth",
  reason: "Rude",
  points: 2,
  categoryId: "r_eurth_hub",
  targetType: null,
  targetId: null,
  expiresAt: days(80),
  revokedAt: null,
  revokedBy: null,
  createdAt: days(-10),
  ...extra,
});

/** The fixture subject's scope, as fileAppeal stores it on the appeal (M7); none for a subject not listed here. */
function subjectScopeOf(subjectType: string, subjectId: string): Row {
  const subject = (subjectType === "ban" ? bans : warnings).find((row) => row.id === subjectId);
  if (!subject) return {};
  if (subjectType === "ban") return { scope: subject.scope, scopeId: subject.scopeId };
  return subject.categoryId === null
    ? { scope: "site", scopeId: null }
    : { scope: "category", scopeId: subject.categoryId };
}

export const appeal = (
  id: string,
  subjectType: string,
  subjectId: string,
  extra: Row = {}
): Row => ({
  id,
  subjectType,
  subjectId,
  ...subjectScopeOf(subjectType, subjectId),
  userId: "u_m",
  body: "Please reconsider this.",
  status: "open",
  reviewedBy: null,
  reviewedAt: null,
  response: null,
  createdAt: days(-1),
  ...extra,
});

export const bans: Row[] = [
  ban("b_realm"),
  ban("b_site", { scope: "site", scopeId: null, issuedBy: "u_a", expiresAt: null }),
  ban("b_auto", {
    scope: "site",
    scopeId: null,
    issuedBy: "u_a",
    auto: true,
    autoTier: 5,
    reason: "Automatic: 7 active warning points",
  }),
  ban("b_cat", { scope: "category", scopeId: "cat_general", issuedBy: "u_gen" }),
  ban("b_lifted", { liftedAt: days(-1), liftedBy: "u_a" }),
  ban("b_expired", { expiresAt: days(-1) }),
  ban("b_other", { userId: "u_o" }),
];

export const warnings: Row[] = [
  warning("w_eurth"),
  warning("w_site", { categoryId: null, issuedBy: "u_a", points: 3 }),
  warning("w_general", { categoryId: "cat_general", issuedBy: "u_a" }),
  warning("w_revoked", { revokedAt: days(-1), revokedBy: "u_a" }),
  warning("w_expired", { createdAt: days(-91), expiresAt: days(-1) }),
];
