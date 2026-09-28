import {
  fetchPageCreator,
  fetchUserPageWikitext,
  fetchWikiUser,
  normalizeWikiUsername,
  WikiApiError,
} from "~/lib/wiki-os/adapters/mediawiki/account-proof";

const json = (body: object) =>
  Promise.resolve({
    ok: true,
    status: 200,
    headers: { get: () => "application/json; charset=utf-8" },
    json: () => Promise.resolve(body),
  });

describe("account-proof", () => {
  const realFetch = global.fetch;
  afterEach(() => {
    global.fetch = realFetch;
  });

  it("normalises MediaWiki usernames", () => {
    expect(normalizeWikiUsername("  some_user  name ")).toBe("Some user name");
    expect(normalizeWikiUsername("kir")).toBe("Kir");
  });

  it("returns the canonical user or null when missing", async () => {
    global.fetch = jest
      .fn()
      .mockReturnValueOnce(json({ query: { users: [{ userid: 7, name: "Kir" }] } }))
      .mockReturnValueOnce(json({ query: { users: [{ name: "Nobody", missing: true }] } })) as any;
    await expect(fetchWikiUser("iiwiki", "kir")).resolves.toEqual({ username: "Kir", userId: 7 });
    await expect(fetchWikiUser("iiwiki", "nobody")).resolves.toBeNull();
  });

  it("reads user page wikitext and the page creator", async () => {
    global.fetch = jest
      .fn()
      .mockReturnValueOnce(
        json({ query: { pages: [{ revisions: [{ slots: { main: { content: "hi ixstates-verify-abc" } } }] }] } })
      )
      .mockReturnValueOnce(json({ query: { pages: [{ revisions: [{ user: "Founder_Name" }] }] } })) as any;
    await expect(fetchUserPageWikitext("ixwiki", "Kir")).resolves.toContain("ixstates-verify-abc");
    await expect(fetchPageCreator("ixwiki", "Aurelia")).resolves.toBe("Founder Name");
  });

  it("throws WikiApiError on a non-JSON (Cloudflare) response", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => "text/html" },
      json: () => Promise.reject(new Error("html")),
    }) as any;
    await expect(fetchWikiUser("iiwiki", "Kir")).rejects.toBeInstanceOf(WikiApiError);
  });
});
