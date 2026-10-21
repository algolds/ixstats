/** @jest-environment node */
import { categoryHref, modHref, realmBoardAttachHref } from "~/lib/thinkpages-forum/links";

describe("forum links", () => {
  it("encodes slugs so they cannot add path segments or query parameters", () => {
    expect(categoryHref({ key: "hub", realm: { slug: "../x" } })).toBe("/thinkpages/r/..%2Fx/hub");
  });

  it("opens the moderation console, encoding the tab and realm", () => {
    expect(modHref()).toBe("/thinkpages/mod");
    expect(modHref({ realm: "eurth" })).toBe("/thinkpages/mod?realm=eurth");
    expect(modHref({ tab: "bans", realm: "a&b" })).toBe("/thinkpages/mod?tab=bans&realm=a%26b");
    expect(modHref({ tab: "log=x" })).toBe("/thinkpages/mod?tab=log%3Dx");
  });
});
describe("attach links", () => {
  it("encodes the slug and the id, so neither can add a parameter", () => {
    expect(realmBoardAttachHref("a b", "x&y=1")).toBe("/thinkpages/r/a%20b?attach=x%26y%3D1");
  });
});
