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
  hasLinkedWikiAccount: false,
  countryName: null,
  isAdmin: false,
  ...overrides,
});

const plain = identity({});
const linked = identity({ hasLinkedWikiAccount: true, wikiUsername: "Linked" });
const admin = identity({ isAdmin: true });
const anonymous = identity({ userId: null, internalUserId: null, wikiUsername: null });

const article = (protectionLevel: string, protectionExpiry: Date | null = null) => ({
  protectionLevel,
  protectionExpiry,
});

describe("canEditProtectedArticle", () => {
  it.each([
    ["new page, signed in", null, plain, true],
    ["ALL, signed in", article("ALL"), plain, true],
    ["ALL, anonymous", article("ALL"), anonymous, false],
    ["AUTOCONFIRMED, no linked account", article("AUTOCONFIRMED"), plain, false],
    ["AUTOCONFIRMED, linked account", article("AUTOCONFIRMED"), linked, true],
    ["AUTOCONFIRMED, admin", article("AUTOCONFIRMED"), admin, true],
    ["SYSOP, linked non-admin", article("SYSOP"), linked, false],
    ["SYSOP, admin", article("SYSOP"), admin, true],
    ["PROTECTED, linked non-admin", article("PROTECTED"), linked, false],
    ["PROTECTED, admin", article("PROTECTED"), admin, true],
    ["unknown level fails closed", article("SOMETHING_NEW"), linked, false],
    ["unknown level, admin", article("SOMETHING_NEW"), admin, true],
    ["expired SYSOP counts as ALL", article("SYSOP", PAST), plain, true],
    ["unexpired SYSOP", article("SYSOP", FUTURE), plain, false],
  ] as const)("%s", (_label, target, who, expected) => {
    expect(canEditProtectedArticle(target, who, NOW)).toBe(expected);
  });
});
