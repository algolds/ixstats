/** @jest-environment node */
/**
 * Plan 2026-10-24 Task 14 fix round 1 (M1): a save the server refused for a reason the author can act on (saving too
 * fast, a page deleted meanwhile, no passport handle) shows the server's sentence; anything else the generic one.
 */
import { SAVE_FAILED, saveFailureMessage } from "~/lib/wiki-os/editor/save-failure";

/** A tRPC client error as the client hands it to the caller: the message, and the code under `data`. */
const refused = (code: string, message: string) =>
  Object.assign(new Error(message), { data: { code } });

describe("saveFailureMessage", () => {
  it.each([
    ["TOO_MANY_REQUESTS", "You are saving too fast. Wait a minute and try again."],
    ["PRECONDITION_FAILED", "This page was deleted; ask an administrator to restore it"],
  ])("shows the server's reason for %s", (code, message) => {
    expect(saveFailureMessage(refused(code, message))).toBe(message);
  });

  it.each([
    ["an internal error", refused("INTERNAL_SERVER_ERROR", "connect ECONNREFUSED db:5432")],
    ["a network failure", new Error("Failed to fetch")],
    ["an error with no code", Object.assign(new Error("odd"), { data: null })],
  ])("keeps the generic sentence for %s", (_, error) => {
    expect(saveFailureMessage(error)).toBe(SAVE_FAILED);
  });

  it("says what failed, in sentence case", () => {
    expect(SAVE_FAILED).toBe("Could not save article changes.");
  });
});
