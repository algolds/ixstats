/**
 * What the lore writer says when a save or the Lore tab record fails: the server's sentence for a refusal the author
 * can act on, a plain line for a title that belongs to a deleted page, and a generic line for anything else.
 */
import {
  RECORD_FAILED,
  isMissingCategoryRefusal,
  recordFailureMessage,
  saveRefusalMessage,
} from "~/lib/lore/writer-messages";
import { SAVE_FAILED } from "~/lib/wiki-os/editor/save-failure";

const refusal = (code: string, message: string) =>
  Object.assign(new Error(message), { data: { code } });

describe("saveRefusalMessage", () => {
  it("says a refused deleted title belongs to a deleted page", () => {
    const deleted = refusal(
      "PRECONDITION_FAILED",
      "This page was deleted; ask an administrator to restore it"
    );
    expect(saveRefusalMessage(deleted)).toMatch(/^This title belongs to a deleted page\./);
  });

  it("shows the server's sentence for another refusal the author can act on", () => {
    expect(saveRefusalMessage(refusal("TOO_MANY_REQUESTS", "Slow down a little"))).toBe(
      "Slow down a little"
    );
    expect(saveRefusalMessage(refusal("PRECONDITION_FAILED", "Pick a passport handle"))).toBe(
      "Pick a passport handle"
    );
  });

  it("does not read a deleted page into another code's message", () => {
    expect(saveRefusalMessage(refusal("INTERNAL_SERVER_ERROR", "row deleted"))).toBe(SAVE_FAILED);
  });
});

describe("recordFailureMessage", () => {
  it.each(["BAD_REQUEST", "FORBIDDEN", "NOT_FOUND", "TOO_MANY_REQUESTS", "CONFLICT"])(
    "shows the server's sentence for %s",
    (code) => {
      expect(recordFailureMessage(refusal(code, "The server's reason."))).toBe(
        "The server's reason."
      );
    }
  );

  it("says something generic for any other failure", () => {
    expect(recordFailureMessage(refusal("INTERNAL_SERVER_ERROR", "stack trace"))).toBe(
      RECORD_FAILED
    );
    expect(recordFailureMessage(new Error("network"))).toBe(RECORD_FAILED);
  });
});

describe("isMissingCategoryRefusal", () => {
  it("is the record refused because the page lacks the country's lore category", () => {
    const missing = refusal("BAD_REQUEST", "This page is not in Caphiria lore yet.");
    expect(isMissingCategoryRefusal(missing, "Caphiria")).toBe(true);
  });

  it("is not another refusal, or the same words under another code", () => {
    expect(
      isMissingCategoryRefusal(
        refusal("BAD_REQUEST", "That is not a valid page title."),
        "Caphiria"
      )
    ).toBe(false);
    expect(
      isMissingCategoryRefusal(
        refusal("FORBIDDEN", "This page is not in Caphiria lore yet."),
        "Caphiria"
      )
    ).toBe(false);
  });
});
