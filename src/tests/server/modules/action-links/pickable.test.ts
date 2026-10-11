/** @jest-environment node */
import { pickableActivities, pickableActivityWhere } from "~/server/modules/action-links";

describe("pickableActivityWhere", () => {
  it("is the country's public rows without the denylisted titles", () => {
    expect(pickableActivityWhere("c1")).toMatchObject({
      countryId: "c1",
      visibility: "public",
      title: {
        notIn: [
          "Names Generated in Onoma Lab",
          "Naming Dictionary Shared",
          "New Nation Founded",
          "Leadership Established",
        ],
      },
    });
  });

  it("leaves out each denylisted event type with a clause that keeps rows without metadata", () => {
    expect(pickableActivityWhere("c1").AND).toEqual([
      {
        OR: [
          { metadata: null },
          { NOT: { metadata: { contains: '"eventType":"economic_tier_change"' } } },
        ],
      },
      {
        OR: [
          { metadata: null },
          { NOT: { metadata: { contains: '"eventType":"achievement_unlocked"' } } },
        ],
      },
    ]);
  });
});

describe("pickableActivityWhere with a search", () => {
  it("adds a case-insensitive title match beside the denylist", () => {
    const where = pickableActivityWhere("c1", "jobs");
    expect(where.title).toMatchObject({ contains: "jobs", mode: "insensitive" });
    expect(where.title).toMatchObject({ notIn: expect.arrayContaining(["New Nation Founded"]) });
    expect(where.AND).toHaveLength(2);
  });

  it("matches no title text without a search", () => {
    expect(pickableActivityWhere("c1").title).not.toHaveProperty("contains");
  });
});

describe("pickableActivities", () => {
  const db = () => ({ activityFeed: { findMany: jest.fn(async () => []) } });

  it("lists the 10 newest with no search", async () => {
    const d = db();
    await pickableActivities(d as never, "c1");
    expect(d.activityFeed.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { createdAt: "desc" },
        take: 10,
        select: { id: true, title: true, type: true, createdAt: true },
        where: pickableActivityWhere("c1"),
      })
    );
  });

  it("lists up to 30 matches for a search", async () => {
    const d = db();
    await pickableActivities(d as never, "c1", "treaty");
    expect(d.activityFeed.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 30, where: pickableActivityWhere("c1", "treaty") })
    );
  });
});
