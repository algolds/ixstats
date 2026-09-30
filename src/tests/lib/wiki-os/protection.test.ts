/** @jest-environment node */
// Plan 409: page protection is the title-keyed `wiki_restrictions` table, enforced by decideAction.
// These are the scenarios the retired row-level check (WikiArticle.protectionLevel) covered.
jest.mock("~/server/db", () => ({ __esModule: true, db: {} }));
jest.mock("~/lib/auth", () => ({ __esModule: true, isSystemOwner: () => false }));

import { decideAction, type PageRestriction } from "~/lib/wiki-os/permissions";
import { rightsForGroups, type Group, type WikiPermissions } from "~/lib/wiki-os/rights";

const NOW = new Date("2026-09-27T12:00:00Z");
const PAST = new Date("2026-09-01T00:00:00Z");
const FUTURE = new Date("2026-12-01T00:00:00Z");

const who = (groups: Group[]): WikiPermissions => ({
  groups,
  rights: rightsForGroups(groups),
  block: null,
  verifiedWikiUsername: null,
});

const plain = who(["*", "user"]);
// The legacy `User.wikiUsername` column grants nothing: such a user is just a plain user.
const legacyUsername = who(["*", "user"]);
// A verified wiki link autoconfirms.
const verified = who(["*", "user", "autoconfirmed"]);
const admin = who(["*", "user", "sysop"]);
const anonymous = who(["*"]);

const restriction = (level: string, expiresAt: Date | null = null): PageRestriction[] => [
  { action: "edit", level, expiresAt },
];

describe("page protection (edit restrictions)", () => {
  it.each([
    ["new page, signed in", "create", [], plain, true],
    ["unprotected, signed in", "edit", [], plain, true],
    ["unprotected, anonymous", "edit", [], anonymous, false],
    [
      "autoconfirmed level, no verified account",
      "edit",
      restriction("autoconfirmed"),
      plain,
      false,
    ],
    [
      "autoconfirmed level, legacy wikiUsername but no verified account",
      "edit",
      restriction("autoconfirmed"),
      legacyUsername,
      false,
    ],
    ["autoconfirmed level, verified account", "edit", restriction("autoconfirmed"), verified, true],
    ["autoconfirmed level, admin", "edit", restriction("autoconfirmed"), admin, true],
    ["sysop level, verified non-admin", "edit", restriction("sysop"), verified, false],
    ["sysop level, admin", "edit", restriction("sysop"), admin, true],
    ["unknown level fails closed", "edit", restriction("SOMETHING_NEW"), verified, false],
    ["unknown level, admin", "edit", restriction("SOMETHING_NEW"), admin, true],
    ["expired sysop level counts as unprotected", "edit", restriction("sysop", PAST), plain, true],
    ["unexpired sysop level", "edit", restriction("sysop", FUTURE), plain, false],
  ] as const)("%s", (_label, action, restrictions, permissions, expected) => {
    const decision = decideAction({
      action,
      title: "Caphiria",
      permissions,
      restrictions: [...restrictions],
      now: NOW,
    });
    expect(decision.allowed).toBe(expected);
  });
});
