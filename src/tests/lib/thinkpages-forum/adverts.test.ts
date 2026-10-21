/** @jest-environment node */
import {
  ADVERT_CATEGORY_KEY,
  isAdvertCategory
} from "~/lib/thinkpages-forum/adverts";
import { newAdvertHref } from "~/lib/thinkpages-forum/links";

describe("isAdvertCategory", () => {
  it("is the sitewide Find a Realm category", () => {
    expect(ADVERT_CATEGORY_KEY).toBe("find-a-realm");
    expect(isAdvertCategory({ key: "find-a-realm" })).toBe(true);
    expect(isAdvertCategory({ key: "find-a-realm", scope: "site" })).toBe(true);
  });

  it("is no other category, and no realm section's category of that key", () => {
    expect(isAdvertCategory({ key: "general", scope: "site" })).toBe(false);
    expect(isAdvertCategory({ key: "hub", scope: "realm" })).toBe(false);
    expect(isAdvertCategory({ key: "find-a-realm", scope: "realm" })).toBe(false);
  });
});

describe("advert constants and links", () => {
  it("links the new advert form with the realm slug encoded", () => {
    expect(newAdvertHref("eurth")).toBe("/thinkpages/c/find-a-realm/new?advert=eurth");
    expect(newAdvertHref("a&b c")).toBe("/thinkpages/c/find-a-realm/new?advert=a%26b%20c");
  });
});
