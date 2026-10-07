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
      .mockReturnValueOnce(
        json({
          query: {
            users: [
              { userid: 7, name: "Kir", editcount: 42, registration: "2026-01-01T00:00:00Z" },
            ],
          },
        })
      )
      .mockReturnValueOnce(json({ query: { users: [{ name: "Nobody", missing: true }] } })) as any;
    await expect(fetchWikiUser("iiwiki", "kir")).resolves.toEqual({
      username: "Kir",
      userId: 7,
      registration: new Date("2026-01-01T00:00:00Z"),
      editCount: 42,
    });
    await expect(fetchWikiUser("iiwiki", "nobody")).resolves.toBeNull();
  });

  it("asks for the account's edit count and registration, and tolerates a wiki that does not say them", async () => {
    const fetchMock = jest
      .fn()
      .mockReturnValueOnce(
        json({ query: { users: [{ userid: 3, name: "Old", registration: null }] } })
      );
    global.fetch = fetchMock as any;

    await expect(fetchWikiUser("iiwiki", "old")).resolves.toEqual({
      username: "Old",
      userId: 3,
      registration: null,
      editCount: null,
    });
    const url = new URL(String(fetchMock.mock.calls[0]?.[0]));
    expect(url.searchParams.get("usprop")).toBe("editcount|registration");
  });

  it("reads the user page revisions saved since a time, oldest first (content + author), and the page creator", async () => {
    const fetchMock = jest
      .fn()
      .mockReturnValueOnce(
        json({
          query: {
            pages: [
              {
                revisions: [
                  { user: "some_editor", slots: { main: { content: "hi" } } },
                  { user: "Kir", slots: { main: { content: "hi ixstates-verify-abc" } } },
                ],
              },
            ],
          },
        })
      )
      .mockReturnValueOnce(json({ query: { pages: [{ revisions: [{ user: "Founder_Name" }] }] } }));
    global.fetch = fetchMock as any;
    await expect(
      fetchUserPageHistory("ixwiki", "kir", new Date("2026-09-27T12:00:00.123Z"))
    ).resolves.toEqual({
      revisions: [
        { content: "hi", author: "Some editor" },
        { content: "hi ixstates-verify-abc", author: "Kir" },
      ],
      complete: true,
    });
    const url = new URL(String(fetchMock.mock.calls[0]?.[0]));
    expect(url.searchParams.get("titles")).toBe("User:Kir");
    expect(url.searchParams.get("rvprop")).toBe("content|user");
    expect(url.searchParams.get("rvlimit")).toBe("20");
    expect(url.searchParams.get("rvdir")).toBe("newer"); // oldest first…
    expect(url.searchParams.get("rvstart")).toBe("2026-09-27T12:00:00Z"); // …from that time to now
    expect(url.searchParams.get("rvend")).toBeNull();
    await expect(fetchPageCreator("ixwiki", "Aurelia")).resolves.toBe("Founder Name");
  });

  it("follows a redirect: the page creator is the target page's, not the redirect's", async () => {
    const fetchMock = jest.fn().mockReturnValueOnce(
      json({
        query: {
          redirects: [{ from: "Aurelia", to: "Federal Republic of Aurelia" }],
          pages: [
            {
              pageid: 12,
              title: "Federal Republic of Aurelia",
              revisions: [{ user: "Founder_Name" }],
            },
          ],
        },
      })
    );
    global.fetch = fetchMock as any;
    await expect(fetchPageCreator("ixwiki", "Aurelia")).resolves.toBe("Founder Name");
    const url = new URL(String(fetchMock.mock.calls[0]?.[0]));
    expect(url.searchParams.get("titles")).toBe("Aurelia");
    expect(url.searchParams.get("redirects")).toBe("1");
    expect(url.searchParams.get("rvdir")).toBe("newer"); // the first revision
    expect(url.searchParams.get("rvlimit")).toBe("1");
  });

  it("reports a truncated window, and a hidden author or content as null (unattributable)", async () => {
    global.fetch = jest.fn().mockReturnValueOnce(
      json({
        continue: { rvcontinue: "20260101000000|42", continue: "||" },
        query: {
          pages: [
            {
              revisions: [
                { userhidden: true, slots: { main: { content: "x" } } },
                { user: "Kir", slots: { main: { texthidden: true } } },
              ],
            },
          ],
        },
      })
    ) as any;
    await expect(fetchUserPageHistory("ixwiki", "Kir", new Date())).resolves.toEqual({
      revisions: [
        { content: "x", author: null },
        { content: null, author: "Kir" },
      ],
      complete: false,
    });
  });

  it("a user page that does not exist has an empty, complete history", async () => {
    global.fetch = jest
      .fn()
      .mockReturnValueOnce(json({ query: { pages: [{ missing: true }] } })) as any;
    await expect(fetchUserPageHistory("ixwiki", "Kir", new Date())).resolves.toEqual({
      revisions: [],
      complete: true,
    });
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
