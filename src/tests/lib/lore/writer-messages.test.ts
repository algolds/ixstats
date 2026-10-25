/**
 * What the lore writer says when a save or the Lore tab record fails: the server's sentence for a refusal the author
 * can act on, a plain line for a title that belongs to a deleted page, and a generic line for anything else.
 */
import {
  RECORD_FAILED,
  isMissingCategoryRefusal,
  recordFailureMessage,
  refusalMessage,
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

describe("refusalMessage: input the server refused as invalid", () => {
  /** A tRPC input refusal as the client receives it: the Zod issues as JSON, and the flattened errors under data. */
  const invalid = (issues: object[]) =>
    Object.assign(new Error(JSON.stringify(issues, null, 2)), {
      data: { code: "BAD_REQUEST", zodError: { formErrors: [], fieldErrors: {} } },
    });

  it("says a title is too long", () => {
    const error = invalid([
      { origin: "string", code: "too_big", maximum: 255, path: ["title"], message: "Too big" },
    ]);
    expect(refusalMessage(error, "Generic")).toBe("That title is too long.");
  });

  it("asks the author to check a title the server refused for another reason", () => {
    const error = invalid([
      { code: "too_small", minimum: 1, path: ["title"], message: "Too small" },
    ]);
    expect(refusalMessage(error, "Generic")).toBe("Check the title and try again.");
  });

  it("asks the owner to check a refused handle", () => {
    const error = invalid([{ code: "invalid_type", path: ["handle"], message: "Invalid input" }]);
    expect(refusalMessage(error, "Generic")).toBe("Check the handle and try again.");
  });

  it("asks to check the entry for any other refused field, never showing the JSON", () => {
    const error = invalid([{ code: "invalid_value", path: ["type"], message: "Invalid option" }]);
    expect(refusalMessage(error, "Generic")).toBe("Check what you entered and try again.");
  });

  it("reads a refusal with validation data but no JSON message as invalid input too", () => {
    const error = Object.assign(new Error("Input validation failed"), {
      data: { code: "BAD_REQUEST", zodError: { formErrors: ["bad"], fieldErrors: {} } },
    });
    expect(refusalMessage(error, "Generic")).toBe("Check what you entered and try again.");
  });

  it("reads a JSON issue list without validation data as invalid input", () => {
    const error = Object.assign(new Error(JSON.stringify([{ code: "too_big", path: ["title"] }])), {
      data: { code: "BAD_REQUEST" },
    });
    expect(refusalMessage(error, "Generic")).toBe("That title is too long.");
  });

  it("still shows the server's own sentence for a plain refusal", () => {
    expect(
      refusalMessage(refusal("BAD_REQUEST", "This page is not in Caphiria lore yet."), "G")
    ).toBe("This page is not in Caphiria lore yet.");
  });

  it("shows a sentence that only happens to parse as JSON, such as a number", () => {
    expect(refusalMessage(refusal("CONFLICT", "42"), "Generic")).toBe("42");
    expect(refusalMessage(refusal("CONFLICT", "null"), "Generic")).toBe("null");
  });

  it("never shows JSON that is not a list of issues", () => {
    const error = refusal("BAD_REQUEST", '{"weird": true}');
    expect(refusalMessage(error, "Generic")).toBe("Check what you entered and try again.");
  });
});
