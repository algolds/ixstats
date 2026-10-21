/** @jest-environment node */
import {
  userMentionItems
} from "~/components/shared/editor/mention-source";
describe("userMentionItems", () => {
  it("keeps the own-persona list, filtered by the query, when there is no source", () => {
    const own = [
      { id: "a1", username: "aria", displayName: "Aria Vance" },
      { id: "a2", username: "bob", displayName: "Bob" },
    ];
    expect(userMentionItems(undefined, own, "")).toHaveLength(2);
    expect(userMentionItems(undefined, own, "ar").map((i) => i.name)).toEqual(["@aria"]);
    expect(userMentionItems(undefined, own, "VANCE").map((i) => i.name)).toEqual(["@aria"]);
    expect(userMentionItems(undefined, undefined, "ar")).toEqual([]);
  });
});
