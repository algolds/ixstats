/** @jest-environment node */
import {
  USER_MENTION_ICON,
  userMentionItems,
  type MentionSource,
} from "~/components/shared/editor/mention-source";

const source = (items: MentionSource["items"]): MentionSource => ({
  items,
  isLoading: false,
  onQueryChange: jest.fn(),
});

describe("userMentionItems", () => {
  it("lists the source's suggestions as @names, a persona marked as one", () => {
    const items = userMentionItems(
      source([
        { kind: "user", name: "kirsten", label: "kirsten", avatarUrl: null },
        { kind: "persona", name: "KirNews", label: "Kir News", avatarUrl: null },
      ]),
      [{ id: "own", username: "ignored", displayName: "Ignored" }],
      "ki"
    );
    expect(items).toEqual([
      expect.objectContaining({
        type: "user",
        id: "user:kirsten",
        name: "@kirsten",
        description: "kirsten",
        icon: USER_MENTION_ICON,
      }),
      expect.objectContaining({
        type: "user",
        id: "persona:KirNews",
        name: "@KirNews",
        description: "Kir News (persona)",
      }),
    ]);
  });

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
