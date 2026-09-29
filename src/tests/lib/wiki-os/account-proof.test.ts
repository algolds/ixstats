import {
  fetchPageCreator,
  fetchUserPageHistory,
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

  it("reads up to 20 user page revisions newest first (content + author), and the page creator", async () => {
    const fetchMock = jest
      .fn()
      .mockReturnValueOnce(
        json({
          query: {
            pages: [
              {
                revisions: [
                  { user: "Kir", slots: { main: { content: "hi ixstates-verify-abc" } } },
                  { user: "some_editor", slots: { main: { content: "hi" } } },
                ],
              },
            ],
          },
        })
      )
      .mockReturnValueOnce(json({ query: { pages: [{ revisions: [{ user: "Founder_Name" }] }] } }));
    global.fetch = fetchMock as any;
    await expect(fetchUserPageHistory("ixwiki", "kir")).resolves.toEqual({
      revisions: [
        { content: "hi ixstates-verify-abc", author: "Kir" },
        { content: "hi", author: "Some editor" },
      ],
      complete: true,
    });
    const url = new URL(String(fetchMock.mock.calls[0]?.[0]));
    expect(url.searchParams.get("titles")).toBe("User:Kir");
    expect(url.searchParams.get("rvprop")).toBe("content|user");
    expect(url.searchParams.get("rvlimit")).toBe("20");
    expect(url.searchParams.get("rvdir")).toBeNull(); // default: newest first
    await expect(fetchPageCreator("ixwiki", "Aurelia")).resolves.toBe("Founder Name");
  });

  it("reports an incomplete history when older revisions exist, and blanks a hidden author or content", async () => {
    global.fetch = jest.fn().mockReturnValueOnce(
      json({
        continue: { rvcontinue: "20260101000000|42", continue: "||" },
        query: { pages: [{ revisions: [{ slots: { main: { content: "x" } } }, { user: "Kir" }] }] },
      })
    ) as any;
    await expect(fetchUserPageHistory("ixwiki", "Kir")).resolves.toEqual({
      revisions: [
        { content: "x", author: "" },
        { content: "", author: "Kir" },
      ],
      complete: false,
    });
  });

  it("a user page that does not exist has an empty, complete history", async () => {
    global.fetch = jest.fn().mockReturnValueOnce(json({ query: { pages: [{ missing: true }] } })) as any;
    await expect(fetchUserPageHistory("ixwiki", "Kir")).resolves.toEqual({ revisions: [], complete: true });
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
