import {
  atlasOrder,
  directoryTotals,
  realmBadge,
  type DirectoryRealm,
} from "~/app/realms/_components/realm-directory";

const BASE: DirectoryRealm = {
  id: "realm-base",
  slug: "base",
  name: "Base",
  description: null,
  thumbnail: null,
  bannerUrl: null,
  tags: [],
  foundedAt: new Date("2026-01-01T00:00:00Z"),
  nationCount: 0,
  openNationCount: 0,
  openNationPageCount: 0,
  myNationCount: 0,
  maxNationsPerUser: 3,
  board: { recentPosts: 0, lastPostAt: null },
  boardMessagesThisWeek: 0,
};

const realm = (over: Partial<DirectoryRealm>): DirectoryRealm => ({ ...BASE, ...over });

describe("atlasOrder", () => {
  it("sorts by open-to-join count, most open first", () => {
    const ixnay = realm({ id: "ixnay", slug: "ixnay", name: "Ixnay", openNationCount: 127 });
    const eurth = realm({ id: "eurth", slug: "eurth", name: "Eurth", openNationCount: 135 });
    expect(atlasOrder([ixnay, eurth]).map((r) => r.name)).toEqual(["Eurth", "Ixnay"]);
  });

  it("counts nation pages with unclaimed countries and breaks ties by name", () => {
    const beta = realm({
      id: "beta",
      slug: "beta",
      name: "Beta",
      openNationCount: 5,
      openNationPageCount: 2,
    });
    const alpha = realm({ id: "alpha", slug: "alpha", name: "Alpha", openNationCount: 7 });
    const gamma = realm({ id: "gamma", slug: "gamma", name: "Gamma", openNationCount: 1 });
    expect(atlasOrder([gamma, beta, alpha]).map((r) => r.name)).toEqual(["Alpha", "Beta", "Gamma"]);
  });

  it("returns a new array and leaves the input unchanged", () => {
    const ixnay = realm({ id: "ixnay", slug: "ixnay", name: "Ixnay", openNationCount: 127 });
    const eurth = realm({ id: "eurth", slug: "eurth", name: "Eurth", openNationCount: 135 });
    const input = [ixnay, eurth];
    const sorted = atlasOrder(input);
    expect(sorted).not.toBe(input);
    expect(input).toEqual([ixnay, eurth]);
  });
});

describe("directoryTotals", () => {
  it("sums realms, nations and open-to-join counts", () => {
    const ixnay = realm({
      id: "ixnay",
      slug: "ixnay",
      name: "Ixnay",
      nationCount: 145,
      openNationCount: 127,
    });
    const eurth = realm({
      id: "eurth",
      slug: "eurth",
      name: "Eurth",
      nationCount: 135,
      openNationCount: 135,
    });
    expect(directoryTotals([ixnay, eurth])).toEqual({ realms: 2, nations: 280, open: 262 });
  });

  it("is all zeros for an empty directory", () => {
    expect(directoryTotals([])).toEqual({ realms: 0, nations: 0, open: 0 });
  });
});

describe("realmBadge", () => {
  it("maps the thumbnail to the crest and marks the realm as not a system realm", () => {
    const badge = realmBadge(
      realm({
        id: "eurth",
        slug: "eurth",
        name: "Eurth",
        thumbnail: "https://cdn.example/eurth.png",
      })
    );
    expect(badge).toEqual({
      id: "eurth",
      slug: "eurth",
      name: "Eurth",
      crestUrl: "https://cdn.example/eurth.png",
      isSystem: false,
    });
  });

  it("uses a null crest when the realm has no thumbnail", () => {
    expect(realmBadge(realm({ thumbnail: null })).crestUrl).toBeNull();
  });
});
