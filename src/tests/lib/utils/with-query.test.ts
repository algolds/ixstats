import { withQuery } from "~/lib/utils/with-query";

describe("withQuery", () => {
  it("leaves a path bare when there is no query", () => {
    expect(withQuery("/vault/cards/market", {})).toBe("/vault/cards/market");
    expect(withQuery("/vault/cards/market", { tab: undefined })).toBe("/vault/cards/market");
  });

  it("keeps every value of a repeated key, in order", () => {
    expect(withQuery("/p", { tab: "trades", give: ["o1", "o2"] })).toBe(
      "/p?tab=trades&give=o1&give=o2"
    );
  });

  it("re-encodes a value so it cannot add a parameter or a fragment", () => {
    expect(withQuery("/p", { tab: "x&admin=1#top" })).toBe("/p?tab=x%26admin%3D1%23top");
  });
});
