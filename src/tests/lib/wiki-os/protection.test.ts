/** @jest-environment node */
jest.mock("~/lib/auth", () => ({
  __esModule: true,
  isSystemOwner: () => false,
}));

import { canEditProtectedArticle, type WikiAuthIdentity } from "~/lib/wiki-os/auth";

const NOW = new Date("2026-09-27T12:00:00Z");
const PAST = new Date("2026-09-01T00:00:00Z");
const FUTURE = new Date("2026-12-01T00:00:00Z");

const identity = (overrides: Partial<WikiAuthIdentity>): WikiAuthIdentity => ({
  internalUserId: "db1",
  userId: "user_1",
  wikiUsername: "User_1",
  hasLegacyWikiUsername: false,
  countryName: null,
  isAdmin: false,
  ...overrides,
});

const plain = identity({});
const legacyUsername = identity({ hasLegacyWikiUsername: true, wikiUsername: "Legacy" });
const admin = identity({ isAdmin: true });
const anonymous = identity({ userId: null, internalUserId: null, wikiUsername: null });

const article = (protectionLevel: string, protectionExpiry: Date | null = null) => ({
  protectionLevel,
  protectionExpiry,
});

describe("canEditProtectedArticle", () => {
  it.each([
    ["new page, signed in", null, plain, false, true],
    ["ALL, signed in", article("ALL"), plain, false, true],
    ["ALL, anonymous", article("ALL"), anonymous, false, false],
    ["AUTOCONFIRMED, no verified account", article("AUTOCONFIRMED"), plain, false, false],
    [
      "AUTOCONFIRMED, legacy wikiUsername but no verified account",
      article("AUTOCONFIRMED"),
      legacyUsername,
      false,
      false,
    ],
    ["AUTOCONFIRMED, verified account", article("AUTOCONFIRMED"), plain, true, true],
    ["AUTOCONFIRMED, admin", article("AUTOCONFIRMED"), admin, false, true],
    ["SYSOP, verified non-admin", article("SYSOP"), plain, true, false],
    ["SYSOP, admin", article("SYSOP"), admin, false, true],
    ["PROTECTED, verified non-admin", article("PROTECTED"), plain, true, false],
    ["PROTECTED, admin", article("PROTECTED"), admin, false, true],
    ["unknown level fails closed", article("SOMETHING_NEW"), plain, true, false],
    ["unknown level, admin", article("SOMETHING_NEW"), admin, false, true],
    ["expired SYSOP counts as ALL", article("SYSOP", PAST), plain, false, true],
    ["unexpired SYSOP", article("SYSOP", FUTURE), plain, false, false],
  ] as const)("%s", (_label, target, who, verified, expected) => {
    expect(canEditProtectedArticle(target, who, verified, NOW)).toBe(expected);
  });
});
