/** @jest-environment node */
import { isAdvertCategory } from "~/lib/thinkpages-forum/adverts";
describe("isAdvertCategory", () => {
  it("is no other category, and no realm section's category of that key", () => {
    expect(isAdvertCategory({ key: "general", scope: "site" })).toBe(false);
    expect(isAdvertCategory({ key: "hub", scope: "realm" })).toBe(false);
    expect(isAdvertCategory({ key: "find-a-realm", scope: "realm" })).toBe(false);
  });
});
