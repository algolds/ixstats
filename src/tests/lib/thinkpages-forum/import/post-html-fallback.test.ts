/** @jest-environment node */
import { importedPostBody, UNSAFE_BODY_NOTE } from "~/lib/thinkpages-forum/import/post-html";

// A sanitizer that always leaves a token inside a tag: the body can never be made safe.
jest.mock("~/lib/utils/sanitize-html", () => ({
  ...jest.requireActual("~/lib/utils/sanitize-html"),
  sanitizeUserContent: jest.fn(() => '<a href="https://x.test/[ixaction=a]">x</a>'),
}));

describe("importedPostBody fallback", () => {
  it("stores a note instead of a body it cannot make safe, and flags it, without throwing", () => {
    const result = importedPostBody({
      message: "hello",
      attachments: [],
      attachmentFor: () => null,
    });
    expect(result.contentHtml).toBe(UNSAFE_BODY_NOTE);
    expect(result.features.fallback).toBe(true);
    expect(result.tokens.kept).toBe(0);
  });
});
