/** @jest-environment node */
/**
 * What Settings shows around account deletion: the name the user types to confirm (the same one
 * `confirmationMatches` accepts) and the pending-deletion notice, and the export file name.
 */
import { confirmationMatches } from "~/lib/account/deletion";
import { confirmationName, deletionNotice, exportFileName } from "~/lib/account/deletion-copy";

describe("confirmationName", () => {
  it("asks for the handle when the user has one", () => {
    const names = { handle: "alex", username: "alexclerk", email: "a@example.com" };
    expect(confirmationName(names)).toBe("alex");
    expect(confirmationMatches(confirmationName(names) ?? "", names)).toBe(true);
  });

  it("falls back to the Clerk username, then the email local part", () => {
    expect(confirmationName({ handle: null, username: "alexclerk", email: "a@b.c" })).toBe(
      "alexclerk"
    );
    const byEmail = { handle: null, username: null, email: "alex.r@example.com" };
    expect(confirmationName(byEmail)).toBe("alex.r");
    expect(confirmationMatches(confirmationName(byEmail) ?? "", byEmail)).toBe(true);
  });

  it("is null when there is nothing to type", () => {
    expect(confirmationName({ handle: null, username: null, email: null })).toBeNull();
  });
});

describe("deletionNotice", () => {
  it("names the day the account is erased", () => {
    expect(deletionNotice(new Date("2026-11-11T12:00:00Z"), "en-GB")).toBe(
      "Your account will be deleted on 11 November 2026."
    );
  });
});

describe("exportFileName", () => {
  it("is dated by the day of the export", () => {
    expect(exportFileName(new Date("2026-10-28T23:00:00Z"))).toBe("ixstates-data-2026-10-28.json");
  });
});
