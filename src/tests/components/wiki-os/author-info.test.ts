import { normalizeAuthorInfo } from "~/components/wiki-os/reader/author-info";

describe("normalizeAuthorInfo (plan 404)", () => {
  it("is null when there is no authorship", () => {
    expect(normalizeAuthorInfo(null)).toBeNull();
    expect(normalizeAuthorInfo(undefined)).toBeNull();
  });

  it("flattens the canonical creator and last editor", () => {
    expect(
      normalizeAuthorInfo({
        creator: { username: "Alice", timestamp: "2026-01-01T00:00:00Z", avatar: "a.png" },
        lastEditor: { username: "Bob", timestamp: "2026-09-01T00:00:00Z" },
        topContributors: [{ username: "Alice", editCount: 3 }],
        totalContributors: 2,
      })
    ).toEqual({
      creator: "Alice",
      creatorAvatar: "a.png",
      createdAt: "2026-01-01T00:00:00Z",
      lastEditor: "Bob",
      lastEditorAvatar: null,
      lastEditedAt: "2026-09-01T00:00:00Z",
      contributors: [{ username: "Alice", editCount: 3 }],
      totalContributors: 2,
    });
  });

  it("prefers the explicit dates over the ones a person carries", () => {
    const info = normalizeAuthorInfo({
      creator: { username: "Alice", timestamp: "old" },
      createdAt: "explicit-created",
      lastEditor: { username: "Bob", timestamp: "old" },
      lastEditedAt: "explicit-edited",
    });

    expect(info).toMatchObject({ createdAt: "explicit-created", lastEditedAt: "explicit-edited" });
  });

  it("accepts a bare creator name and the legacy author, avatar and date fields", () => {
    expect(
      normalizeAuthorInfo({
        creator: "Carol",
        creatorAvatar: "c.png",
        lastEditor: "Dan",
        lastEditorAvatar: "d.png",
        createdTimestamp: "t1",
        lastModifiedTimestamp: "t2",
      })
    ).toMatchObject({
      creator: "Carol",
      creatorAvatar: "c.png",
      lastEditor: "Dan",
      lastEditorAvatar: "d.png",
      createdAt: "t1",
      lastEditedAt: "t2",
    });
    expect(normalizeAuthorInfo({ author: "Eve" })?.creator).toBe("Eve");
  });

  it("has no creator or contributors when the article has no history", () => {
    expect(
      normalizeAuthorInfo({
        creator: null,
        lastEditor: null,
        topContributors: [],
        contributors: [],
        totalContributors: 0,
      })
    ).toEqual({
      creator: null,
      creatorAvatar: null,
      createdAt: null,
      lastEditor: null,
      lastEditorAvatar: null,
      lastEditedAt: null,
      contributors: [],
      totalContributors: 0,
    });
  });

  it("falls back to the contributor list and counts it", () => {
    const info = normalizeAuthorInfo({ contributors: [{ username: "A" }, { username: "B" }] });

    expect(info?.contributors).toHaveLength(2);
    expect(info?.totalContributors).toBe(2);
  });
});
