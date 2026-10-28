/** @jest-environment node */
/**
 * Account deletion's pure rules (Privacy 5.2): the 14-day grace, when a request is due, the erased-account sentinel,
 * the anonymous persona names and which typed name confirms the request.
 */
import {
  ACCOUNT_DELETION_GRACE_DAYS,
  confirmationMatches,
  erasedClerkId,
  erasesAt,
  FORMER_MEMBER,
  formerUsername,
  isDue,
  isErasedClerkId,
  requestedBefore,
} from "~/lib/account/deletion";

const DAY = 24 * 60 * 60 * 1000;
const requested = new Date("2026-10-01T12:00:00Z");

describe("grace period", () => {
  it("erases 14 days after the request, and nothing when none is pending", () => {
    expect(ACCOUNT_DELETION_GRACE_DAYS).toBe(14);
    expect(erasesAt(requested)?.toISOString()).toBe("2026-10-15T12:00:00.000Z");
    expect(erasesAt(null)).toBeNull();
  });

  it("is due once the grace has passed, never before and never without a request", () => {
    expect(isDue(requested, new Date(requested.getTime() + 14 * DAY - 1))).toBe(false);
    expect(isDue(requested, new Date(requested.getTime() + 14 * DAY))).toBe(true);
    expect(isDue(null, new Date("2030-01-01"))).toBe(false);
  });

  it("finds due requests by the cutoff 14 days before now", () => {
    const now = new Date("2026-10-15T12:00:00Z");
    expect(requestedBefore(now).toISOString()).toBe(requested.toISOString());
  });
});

describe("erased accounts", () => {
  it("marks a tombstone with a sentinel no Clerk id can match", () => {
    expect(erasedClerkId("cuid123")).toBe("erased:cuid123");
    expect(isErasedClerkId("erased:cuid123")).toBe(true);
    expect(isErasedClerkId("user_2abc")).toBe(false);
  });

  it("credits public content to a former member, with a unique persona username", () => {
    expect(FORMER_MEMBER).toBe("a former member");
    expect(formerUsername("clxyz0000abcdefgh")).toBe("former-abcdefgh");
    expect(formerUsername("A-B_c")).toBe("former-a-b_c");
  });
});

describe("confirmationMatches", () => {
  it("takes the handle when the user has one, ignoring case, spaces and a leading @", () => {
    const names = { handle: "aurelia", username: "aurelia_x", email: "a@example.com" };
    expect(confirmationMatches(" @Aurelia ", names)).toBe(true);
    expect(confirmationMatches("aurelia_x", names)).toBe(false);
    expect(confirmationMatches("a", names)).toBe(false);
  });

  it("takes the username or the email's local part when there is no handle", () => {
    const names = { handle: null, username: "Tamsin", email: "tam.sin@example.com" };
    expect(confirmationMatches("tamsin", names)).toBe(true);
    expect(confirmationMatches("tam.sin", names)).toBe(true);
    expect(confirmationMatches("example.com", names)).toBe(false);
  });

  it("refuses an empty answer, even when the account has no names at all", () => {
    expect(confirmationMatches("", { handle: null, username: null, email: null })).toBe(false);
    expect(confirmationMatches("  ", { handle: null, username: "", email: "" })).toBe(false);
  });
});
