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
  it("lists the source's suggestions as @names with an avatar and no icon", () => {
    const items = userMentionItems(
      source([
        { kind: "user", name: "kirsten", label: "kirsten", avatarUrl: null },
        { kind: "user", name: "owena", label: "Owen A", avatarUrl: "https://x/o.png" },
      ]),
      [{ id: "own", username: "ignored", displayName: "Ignored" }],
      "ki"
    );
    expect(items).toEqual([
      expect.objectContaining({
        type: "user",
        id: "user:kirsten",
        name: "@kirsten",
        description: "",
        icon: "",
        avatar: { url: null },
      }),
      expect.objectContaining({
        id: "user:owena",
        name: "@owena",
        description: "Owen A",
        icon: "",
        avatar: { url: "https://x/o.png" },
      }),
    ]);
    expect(items.some((i) => i.icon === USER_MENTION_ICON)).toBe(false);
  });

  it("leads a persona with its display name over its username", () => {
    const [persona, same] = userMentionItems(
      source([
        { kind: "persona", name: "KirNews", label: "Kir News", avatarUrl: null },
        { kind: "persona", name: "Kir", label: "Kir", avatarUrl: null },
      ]),
      undefined,
      ""
    );
    expect(persona).toEqual(
      expect.objectContaining({
        id: "persona:KirNews",
        name: "@KirNews",
        title: "Kir News",
        description: "@KirNews",
      })
    );
    expect(same).toEqual(expect.objectContaining({ name: "@Kir", description: "" }));
    expect(same?.title).toBeUndefined();
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
