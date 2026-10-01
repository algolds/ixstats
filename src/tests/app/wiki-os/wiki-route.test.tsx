/**
 * Plan 412: the server route behind every /wiki/<path> URL. The page function is called with a
 * mocked tRPC server caller; what it renders is read off the returned element tree, and what it
 * refuses is read off next/navigation's redirect, permanentRedirect and notFound.
 */
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { TRPCError } from "@trpc/server";

class RouteSignal extends Error {}
const mockNotFound = jest.fn(() => {
  throw new RouteSignal("not-found");
});
const mockRedirect = jest.fn((url: string) => {
  throw new RouteSignal(`redirect:${url}`);
});
const mockPermanentRedirect = jest.fn((url: string) => {
  throw new RouteSignal(`permanent:${url}`);
});
jest.mock("next/navigation", () => ({
  notFound: () => mockNotFound(),
  redirect: (url: string) => mockRedirect(url),
  permanentRedirect: (url: string) => mockPermanentRedirect(url),
}));

const mockArticlePrefetch = jest.fn();
const mockRevisionPrefetch = jest.fn();
const mockPrefetchedState = jest.fn();
const mockMissingPages = jest.fn();
const mockRandomPage = jest.fn();
const mockFileInfo = jest.fn();
const mockCategoryPage = jest.fn();
const mockListPages = jest.fn();
const mockPageInfo = jest.fn();
const mockHistory = jest.fn();
const mockResolveAuthor = jest.fn();
jest.mock("~/trpc/server", () => ({
  __esModule: true,
  api: {
    users: { resolveWikiAuthor: (...args: unknown[]) => mockResolveAuthor(...args) },
    wikios: {
      getArticleHtml: { prefetch: (...args: unknown[]) => mockArticlePrefetch(...args) },
      getRevisionHtml: { prefetch: (...args: unknown[]) => mockRevisionPrefetch(...args) },
      getMissingPages: (...args: unknown[]) => mockMissingPages(...args),
      getRandomPage: (...args: unknown[]) => mockRandomPage(...args),
      getFileInfo: (...args: unknown[]) => mockFileInfo(...args),
      getCategoryPage: (...args: unknown[]) => mockCategoryPage(...args),
      listPages: (...args: unknown[]) => mockListPages(...args),
      getPageInfo: (...args: unknown[]) => mockPageInfo(...args),
      getHistory: (...args: unknown[]) => mockHistory(...args),
    },
  },
  HydrateClient: function HydrateClient({ children }: { children: ReactNode }) {
    return children;
  },
  prefetchedState: (...args: unknown[]) => mockPrefetchedState(...args),
}));

jest.mock("~/app/(wiki-os)/wiki/[...slug]/ArticlePageClient", () => ({
  __esModule: true,
  default: function ArticlePageClient() {
    return null;
  },
}));
jest.mock("~/components/wiki-os/shared/WikiOSLayout", () => ({
  WikiOSLayout: function WikiOSLayout({ children }: { children: ReactNode }) {
    return children;
  },
}));
jest.mock("~/components/wiki-os/history/PageHistoryView", () => ({
  PageHistoryView: function PageHistoryView() {
    return null;
  },
}));
jest.mock("~/components/wiki-os/history/RevisionDiffView", () => ({
  RevisionDiffView: function RevisionDiffView() {
    return null;
  },
}));
jest.mock("~/components/wiki-os/reader/RevisionView", () => ({
  RevisionView: function RevisionView() {
    return null;
  },
}));
jest.mock("~/components/wiki-os/reader/UserProfileCard", () => ({
  UserProfileCard: function UserProfileCard() {
    return null;
  },
}));

import WikiPage, { generateMetadata } from "~/app/(wiki-os)/wiki/[...slug]/page";

type Query = Record<string, string | string[] | undefined>;

const render = (slug: string[], query: Query = {}) =>
  WikiPage({ params: Promise.resolve({ slug }), searchParams: Promise.resolve(query) });

/** Every element in a returned tree, outermost first. */
function elementsIn(node: ReactNode, found: ReactElement[] = []): ReactElement[] {
  if (Array.isArray(node)) node.forEach((child) => elementsIn(child, found));
  else if (isValidElement(node)) {
    found.push(node);
    elementsIn((node.props as { children?: ReactNode }).children, found);
  }
  return found;
}

const named = (node: ReactNode, name: string) =>
  elementsIn(node).find((element) => (element.type as { name?: string }).name === name);

const propsOf = (node: ReactNode, name: string) =>
  (named(node, name)?.props ?? null) as Record<string, unknown> | null;

/** What a route call settles to: the signal the route threw, or the tree it returned. */
async function outcome(slug: string[], query: Query = {}) {
  try {
    return { tree: await render(slug, query), signal: null };
  } catch (error) {
    if (error instanceof RouteSignal) return { tree: null, signal: error.message };
    throw error;
  }
}

const article = (overrides: Record<string, unknown> = {}) => ({
  title: "Aurelia",
  contentHtml: "<p>Aurelia is a country of Eurth, known for its long coast and its fleets.</p>",
  infoboxHtml: null,
  noticesHtml: null,
  toc: [],
  categories: [],
  lastModified: null,
  resolvedFrom: null,
  redirectFragment: null,
  ...overrides,
});

const succeeds = (data: Record<string, unknown>) =>
  mockPrefetchedState.mockReturnValue({ status: "success", data });
const fails = (code: ConstructorParameters<typeof TRPCError>[0]["code"]) =>
  mockPrefetchedState.mockReturnValue({ status: "error", error: new TRPCError({ code }) });

beforeEach(() => {
  jest.clearAllMocks();
  succeeds(article());
  mockMissingPages.mockResolvedValue([]);
  mockCategoryPage.mockResolvedValue({ members: [], total: 0, next: null });
  mockFileInfo.mockResolvedValue(null);
  mockResolveAuthor.mockResolvedValue({ wikiUsername: "Jane" });
});

describe("an article is read on the server (plan 412 step 2)", () => {
  it("primes the query the client reads, and hands the client the canonical title", async () => {
    const { tree, signal } = await outcome(["aurelia"]);

    // Not canonical: "aurelia" is "Aurelia". Nothing is fetched before the redirect.
    expect(signal).toBe("permanent:/wiki/Aurelia");
    expect(mockArticlePrefetch).not.toHaveBeenCalled();
    expect(tree).toBeNull();

    const ok = await outcome(["Aurelia"]);
    expect(mockArticlePrefetch).toHaveBeenCalledWith({ title: "Aurelia" }, { retry: false });
    expect(mockPrefetchedState).toHaveBeenCalledWith(["wikios", "getArticleHtml"], {
      title: "Aurelia",
    });
    expect(propsOf(ok.tree, "ArticlePageClient")).toMatchObject({
      title: "Aurelia",
      wikiSource: "ixwiki",
      followRedirect: true,
      redirectedFrom: null,
    });
    expect(named(ok.tree, "HydrateClient")).toBeDefined(); // the client finds the article in its cache
  });

  it("a page that does not exist is notFound() (HTTP 404)", async () => {
    fails("NOT_FOUND");
    expect((await outcome(["Nowhere"])).signal).toBe("not-found");
    expect(mockNotFound).toHaveBeenCalledTimes(1);
  });

  it("a title MediaWiki would refuse is notFound() without asking the database", async () => {
    expect((await outcome(["a%5Bb"])).signal).toBe("not-found");
    expect(mockArticlePrefetch).not.toHaveBeenCalled();
  });

  it("a redirect page is a permanent redirect with ?rdfrom= and the target's section", async () => {
    succeeds(
      article({ title: "New name", resolvedFrom: "Old name", redirectFragment: "Early history" })
    );
    const { signal } = await outcome(["Old_name"]);

    expect(signal).toBe("permanent:/wiki/New_name?rdfrom=Old+name#Early_history");
    expect(mockNotFound).not.toHaveBeenCalled();
  });

  it("a redirect keeps the rest of the query, and drops ?redirect= and an old ?rdfrom=", async () => {
    succeeds(article({ title: "New name", resolvedFrom: "Old name" }));
    const { signal } = await outcome(["Old_name"], { margin: "threads", rdfrom: "Stale" });

    expect(signal).toBe("permanent:/wiki/New_name?margin=threads&rdfrom=Old+name");
  });

  it("a redirect page whose target does not exist is rendered where it is: no 404, no redirect to a missing page", async () => {
    // getArticleHtml answers the redirect page itself (resolvedFrom null) when the target is missing.
    succeeds(
      article({
        title: "Old name",
        resolvedFrom: null,
        contentHtml: '<div class="redirectMsg"></div>',
      })
    );
    const { tree, signal } = await outcome(["Old_name"]);

    expect(signal).toBeNull();
    expect(propsOf(tree, "ArticlePageClient")).toMatchObject({ title: "Old name" });
  });

  it("?redirect=no reads the redirect page itself, and says so to the client", async () => {
    succeeds(article({ title: "Old name" }));
    const { tree, signal } = await outcome(["Old_name"], { redirect: "no" });

    expect(signal).toBeNull();
    expect(mockArticlePrefetch).toHaveBeenCalledWith(
      { title: "Old name", redirect: "no" },
      { retry: false }
    );
    expect(propsOf(tree, "ArticlePageClient")).toMatchObject({ followRedirect: false });
  });

  it("?rdfrom= becomes the client's (Redirected from X) note", async () => {
    succeeds(article({ title: "New name" }));
    const { tree } = await outcome(["New_name"], { rdfrom: "Old_name" });

    expect(propsOf(tree, "ArticlePageClient")).toMatchObject({ redirectedFrom: "Old name" });
  });

  it("moves a non-canonical spelling to the canonical one, keeping the query", async () => {
    const { signal } = await outcome(["foo_bar"], { margin: "threads" });
    expect(signal).toBe("permanent:/wiki/Foo_bar?margin=threads");
  });

  it("carries a section typed into the path over as the fragment", async () => {
    const { signal } = await outcome(["user%20talk%3Ajane%23Notes"]);
    expect(signal).toBe("permanent:/wiki/User_talk:Jane#Notes");
  });

  it("does not move a URL that already is canonical, however it is percent-encoded", async () => {
    for (const slug of [["Portal%3AEurth"], ["Portal:Eurth"], ["100%25_Pure"]]) {
      expect((await outcome(slug)).signal).toBeNull();
    }
  });

  it("reads a subpage by its whole title", async () => {
    await outcome(["Template:Foo", "doc"]);
    expect(mockArticlePrefetch).toHaveBeenCalledWith(
      { title: "Template:Foo/doc" },
      { retry: false }
    );
  });

  it("a busy or failed lookup is not a 404: the client asks again", async () => {
    fails("TOO_MANY_REQUESTS");
    const { tree, signal } = await outcome(["Aurelia"]);

    expect(signal).toBeNull();
    expect(mockNotFound).not.toHaveBeenCalled();
    expect(propsOf(tree, "ArticlePageClient")).toMatchObject({ title: "Aurelia" });
  });

  it("the Main Page is rendered by the client without reading an article", async () => {
    const { tree } = await outcome(["Main_Page"]);
    expect(mockArticlePrefetch).not.toHaveBeenCalled();
    expect(propsOf(tree, "ArticlePageClient")).toMatchObject({ title: "Main Page" });
  });

  it("another wiki's page is client-rendered, exactly as before: no read, no 404, no move", async () => {
    const { tree, signal } = await outcome(["foo_bar"], { source: "iiwiki" });

    expect(signal).toBeNull();
    expect(mockArticlePrefetch).not.toHaveBeenCalled();
    expect(propsOf(tree, "ArticlePageClient")).toMatchObject({
      title: "Foo bar",
      wikiSource: "iiwiki",
    });
  });

  it("?action=edit opens the editor without reading the article, so a missing page can be created", async () => {
    fails("NOT_FOUND");
    const { tree, signal } = await outcome(["Talk:Aurelia"], {
      action: "edit",
      section: "new",
    });

    expect(signal).toBeNull();
    expect(mockArticlePrefetch).not.toHaveBeenCalled();
    expect(propsOf(tree, "ArticlePageClient")).toMatchObject({
      title: "Talk:Aurelia",
      initialEdit: { mode: "source", section: "new" },
    });
  });

  it("?veaction=edit opens the visual editor", async () => {
    const { tree } = await outcome(["Aurelia"], { veaction: "edit" });
    expect(propsOf(tree, "ArticlePageClient")).toMatchObject({
      initialEdit: { mode: "visual", section: null },
    });
  });
});

describe("old WikiOS URLs (plan 412 step 1)", () => {
  it("a tool slug redirects to its tool when no article has that title", async () => {
    mockMissingPages.mockResolvedValue(["Recent-changes"]);
    const { signal } = await outcome(["recent-changes"]);

    expect(mockMissingPages).toHaveBeenCalledWith({ titles: ["Recent-changes"] });
    expect(signal).toBe("redirect:/util/recent-changes");
  });

  it("a tool slug is the article when one has that title: a tool never hijacks a title", async () => {
    mockMissingPages.mockResolvedValue([]);
    succeeds(article({ title: "Random" }));
    const { signal } = await outcome(["random"]);

    // The article "Random" exists: the URL moves to its canonical spelling and is read there.
    expect(signal).toBe("permanent:/wiki/Random");
    const read = await outcome(["Random"]);
    expect(read.signal).toBeNull();
    expect(mockMissingPages).toHaveBeenCalledTimes(1);
  });

  it("keeps a tool's arguments: the query and the page it was asked about", async () => {
    mockMissingPages.mockResolvedValue(["Search"]);
    expect((await outcome(["search"], { q: "eurth" })).signal).toBe(
      "redirect:/util/search?q=eurth"
    );

    mockMissingPages.mockResolvedValue(["History/Foo_bar"]);
    expect((await outcome(["history", "Foo_bar"])).signal).toBe("redirect:/util/history/Foo_bar");
  });

  it("an action asked of an article that exists is honoured before the old-URL redirects (plan 412 review)", async () => {
    // "Foo/talk" exists as a page: ?action=raw is its raw text, not a redirect to Talk:Foo.
    mockMissingPages.mockResolvedValue([]);
    expect((await outcome(["Foo", "talk"], { action: "raw" })).signal).toBe(
      "redirect:/api/wiki/raw?path=Foo%2Ftalk&action=raw"
    );
    // So is the tool slug's article: "Search" exists, ?action=raw reads it, no /util/search.
    expect((await outcome(["search"], { action: "raw", oldid: "7" })).signal).toBe(
      "redirect:/api/wiki/raw?path=Search&action=raw&oldid=7"
    );
    expect((await outcome(["Foo", "edit"], { action: "history" })).tree).not.toBeNull();
    expect(
      propsOf((await outcome(["Foo", "edit"], { action: "history" })).tree, "PageHistoryView")
    ).toMatchObject({
      title: "Foo/edit",
    });
    expect((await outcome(["search"], { oldid: "a b" })).signal).toBe("not-found");

    // With no such article the old URL does what it always did, whatever the query says.
    mockMissingPages.mockResolvedValue(["Foo/talk"]);
    expect((await outcome(["Foo", "talk"], { action: "raw" })).signal).toBe(
      "redirect:/wiki/Talk:Foo"
    );
    mockMissingPages.mockResolvedValue(["Search"]);
    expect((await outcome(["search"], { action: "raw" })).signal).toBe(
      "redirect:/util/search?action=raw"
    );
  });

  it("/<title>/edit goes to ?action=edit, /<title>/talk to the talk page", async () => {
    mockMissingPages.mockResolvedValue(["Foo bar/edit"]);
    expect((await outcome(["foo_bar", "edit"])).signal).toBe("redirect:/wiki/Foo_bar?action=edit");

    mockMissingPages.mockResolvedValue(["Foo bar/talk"]);
    expect((await outcome(["foo_bar", "talk"])).signal).toBe("redirect:/wiki/Talk:Foo_bar");
  });

  it("/<title>/edit is a subpage when a page with that title exists", async () => {
    mockMissingPages.mockResolvedValue([]);
    const { signal } = await outcome(["Foo", "edit"]);
    expect(signal).toBeNull();
    expect(mockArticlePrefetch).toHaveBeenCalledWith({ title: "Foo/edit" }, { retry: false });
  });
});

describe("Special: pages (plan 412 step 3)", () => {
  it("maps the tools WikiOS has, keeping their arguments", async () => {
    expect((await outcome(["Special:RecentChanges"])).signal).toBe("redirect:/util/recent-changes");
    expect((await outcome(["Special:Diff", "12", "13"])).signal).toBe(
      "redirect:/util/diff?from=12&to=13"
    );
    expect((await outcome(["Special:Search"], { search: "eurth" })).signal).toBe(
      "redirect:/util/search?q=eurth"
    );
    expect((await outcome(["Special:Contributions", "Jane"])).signal).toBe(
      "redirect:/util/contributions/Jane"
    );
    expect((await outcome(["Special:Export"])).signal).toBe("redirect:/util/export");
    expect((await outcome(["Special:Import"])).signal).toBe("redirect:/util/import");
  });

  it("maps the rights-model special pages to their /util screens (plan 409)", async () => {
    expect((await outcome(["Special:Log", "move"])).signal).toBe("redirect:/util/log?type=move");
    expect((await outcome(["Special:Move", "Foo_bar"])).signal).toBe(
      "redirect:/util/move?title=Foo+bar"
    );
    expect((await outcome(["Special:Undelete", "Foo"])).signal).toBe(
      "redirect:/util/undelete?title=Foo"
    );
    expect((await outcome(["Special:Block", "Jane"])).signal).toBe(
      "redirect:/util/block?user=Jane"
    );
    expect((await outcome(["Special:BlockList"])).signal).toBe("redirect:/util/blocklist");
    expect((await outcome(["Special:UserRights", "Jane"])).signal).toBe(
      "redirect:/util/userrights?user=Jane"
    );
  });

  it("?action=delete, protect and unprotect on a page go to the /util screens", async () => {
    expect((await outcome(["foo_bar"], { action: "delete" })).signal).toBe(
      "permanent:/wiki/Foo_bar?action=delete"
    );
    expect((await outcome(["Foo"], { action: "delete" })).signal).toBe(
      "redirect:/util/delete?title=Foo"
    );
    expect((await outcome(["Foo"], { action: "protect" })).signal).toBe(
      "redirect:/util/protect?title=Foo"
    );
    expect((await outcome(["Foo"], { action: "unprotect" })).signal).toBe(
      "redirect:/util/protect?title=Foo"
    );
    expect(mockArticlePrefetch).not.toHaveBeenCalled();
  });

  it("Special:Random redirects to a random page", async () => {
    mockRandomPage.mockResolvedValue({ title: "Treaty of Oakhaven/Text" });
    expect((await outcome(["Special:Random"])).signal).toBe(
      "redirect:/wiki/Treaty_of_Oakhaven/Text"
    );

    mockRandomPage.mockResolvedValue({ title: null });
    expect((await outcome(["Special:Random"])).signal).toBe("not-found");
  });

  it("Special:FilePath redirects to the file's URL, and is a 404 for a file WikiOS does not know", async () => {
    mockFileInfo.mockResolvedValue({ url: "https://ixwiki.com/images/a/ab/Flag.svg" });
    expect((await outcome(["Special:FilePath", "Flag.svg"])).signal).toBe(
      "redirect:https://ixwiki.com/images/a/ab/Flag.svg"
    );
    expect(mockFileInfo).toHaveBeenCalledWith({ file: "Flag.svg" });

    mockFileInfo.mockResolvedValue({ url: "//cdn.example/Flag.svg" });
    expect((await outcome(["Special:FilePath", "Flag.svg"])).signal).toBe(
      "redirect:https://cdn.example/Flag.svg"
    );

    mockFileInfo.mockResolvedValue(null);
    expect((await outcome(["Special:FilePath", "Nope.svg"])).signal).toBe("not-found");
  });

  it("Special:FilePath does not double the base path: redirect() adds it, so an already prefixed URL loses it", async () => {
    const saved = process.env.BASE_PATH;
    process.env.BASE_PATH = "/projects/ixstats";
    try {
      mockFileInfo.mockResolvedValue({
        url: "/projects/ixstats/api/mediawiki/ixwiki/images/6/61/Flag.svg",
      });
      expect((await outcome(["Special:FilePath", "Flag.svg"])).signal).toBe(
        "redirect:/api/mediawiki/ixwiki/images/6/61/Flag.svg"
      );
      // Not on a segment boundary, not site-relative or without the prefix: left alone.
      mockFileInfo.mockResolvedValue({ url: "/projects/ixstatsX/a.svg" });
      expect((await outcome(["Special:FilePath", "A.svg"])).signal).toBe(
        "redirect:/projects/ixstatsX/a.svg"
      );
      mockFileInfo.mockResolvedValue({ url: "/images/uploads/Flag.svg" });
      expect((await outcome(["Special:FilePath", "Flag.svg"])).signal).toBe(
        "redirect:/images/uploads/Flag.svg"
      );
      mockFileInfo.mockResolvedValue({ url: "https://ixwiki.com/projects/ixstats/x.svg" });
      expect((await outcome(["Special:FilePath", "X.svg"])).signal).toBe(
        "redirect:https://ixwiki.com/projects/ixstats/x.svg"
      );
    } finally {
      if (saved === undefined) delete process.env.BASE_PATH;
      else process.env.BASE_PATH = saved;
    }
  });

  it("Special:AllPages and PrefixIndex list pages from a cursor", async () => {
    mockListPages.mockResolvedValue({
      pages: [
        { title: "Aurelia", isRedirect: false },
        { title: "Aurelian Sea", isRedirect: true },
      ],
      next: "Aurora",
    });
    const { tree } = await outcome(["Special:PrefixIndex", "Aur"], { namespace: "0", from: "Au" });

    expect(mockListPages).toHaveBeenCalledWith({
      namespace: 0,
      prefix: "Aur",
      from: "Au",
      limit: 200,
    });
    expect(propsOf(tree, "PageList")).toMatchObject({
      next: "Aurora",
      from: "Au",
      specialPath: "Special:PrefixIndex",
      query: { namespace: "0", prefix: "Aur" },
    });

    await outcome(["Special:AllPages"]);
    expect(mockListPages).toHaveBeenLastCalledWith({
      namespace: 0,
      prefix: "",
      from: "",
      limit: 200,
    });
  });

  it("an input the procedures refuse (a title or cursor too long to be one) is a 404, not a 500", async () => {
    const refused = new TRPCError({ code: "BAD_REQUEST" });
    mockListPages.mockRejectedValue(refused);
    expect((await outcome(["Special:AllPages"], { from: "x".repeat(300) })).signal).toBe(
      "not-found"
    );
    mockFileInfo.mockRejectedValue(refused);
    expect((await outcome(["Special:FilePath", "x".repeat(300)])).signal).toBe("not-found");
    mockMissingPages.mockRejectedValue(refused);
    expect((await outcome(["recent-changes"])).signal).toBe("not-found");
  });

  it("an unknown special page is a 404, not a redirect to the utilities", async () => {
    expect((await outcome(["Special:NoSuchThing"])).signal).toBe("not-found");
    expect((await outcome(["Special:constructor"])).signal).toBe("not-found");
  });

  it("?action=raw that reached the page (the proxy rewrite did not) goes to the raw route, by its contract", async () => {
    expect((await outcome(["Foo_bar"], { action: "raw" })).signal).toBe(
      "redirect:/api/wiki/raw?path=Foo_bar&action=raw"
    );
    expect((await outcome(["Foo"], { action: "raw", oldid: "77" })).signal).toBe(
      "redirect:/api/wiki/raw?path=Foo&action=raw&oldid=77"
    );
  });
});

describe("namespaced pages (plan 412 step 4)", () => {
  it("a talk page is an ordinary page", async () => {
    succeeds(article({ title: "Talk:Aurelia" }));
    const { tree } = await outcome(["Talk:Aurelia"]);

    expect(mockArticlePrefetch).toHaveBeenCalledWith({ title: "Talk:Aurelia" }, { retry: false });
    expect(propsOf(tree, "ArticlePageClient")).toMatchObject({ title: "Talk:Aurelia" });
  });

  it("a user page shows the profile card beside its text", async () => {
    succeeds(article({ title: "User:Jane/Sandbox" }));
    const { tree } = await outcome(["User:Jane", "Sandbox"]);

    const client = propsOf(tree, "ArticlePageClient");
    expect(isValidElement(client?.aside)).toBe(true);
    expect((client?.aside as ReactElement).props).toMatchObject({
      username: "Jane",
      pageExists: true,
    });
  });

  it("a user with no user page still gets the card, not a 404; a missing subpage is a 404", async () => {
    fails("NOT_FOUND");
    const { tree, signal } = await outcome(["User:Jane"]);

    expect(signal).toBeNull();
    expect(mockResolveAuthor).toHaveBeenCalledWith({ wikiUsername: "Jane" });
    expect(propsOf(tree, "UserProfileCard")).toMatchObject({ username: "Jane", pageExists: false });
    expect(named(tree, "ArticlePageClient")).toBeUndefined();

    expect((await outcome(["User:Jane", "Nothing"])).signal).toBe("not-found");
  });

  it("a user page for someone who does not exist is a 404, in the page and in the metadata (like MediaWiki)", async () => {
    fails("NOT_FOUND");
    mockResolveAuthor.mockResolvedValue(null);

    expect((await outcome(["User:Nobody_at_all"])).signal).toBe("not-found");
    expect(mockResolveAuthor).toHaveBeenCalledWith({ wikiUsername: "Nobody at all" });
    await expect(
      generateMetadata({
        params: Promise.resolve({ slug: ["User:Nobody_at_all"] }),
        searchParams: Promise.resolve({}),
      })
    ).rejects.toThrow("not-found");
    // A user name too long to be one is not a user.
    mockResolveAuthor.mockRejectedValue(new TRPCError({ code: "BAD_REQUEST" }));
    expect((await outcome(["User:X" + "x".repeat(150)])).signal).toBe("not-found");
  });

  it("a user who exists but has no page gets the card with noindex metadata; a busy lookup shows the card too", async () => {
    fails("NOT_FOUND");
    await expect(
      generateMetadata({
        params: Promise.resolve({ slug: ["User:Jane"] }),
        searchParams: Promise.resolve({}),
      })
    ).resolves.toEqual({
      title: "User:Jane",
      alternates: { canonical: "https://ixwiki.com/wiki/User:Jane" },
      robots: { index: false, follow: false },
    });

    // The lookup is rate limited: "busy" is not "no such user".
    mockResolveAuthor.mockRejectedValue(new TRPCError({ code: "TOO_MANY_REQUESTS" }));
    expect(propsOf((await outcome(["User:Jane"])).tree, "UserProfileCard")).toMatchObject({
      pageExists: false,
    });
  });

  it("a user page with text is shown without asking whether the user exists", async () => {
    succeeds(article({ title: "User:Jane" }));
    await outcome(["User:Jane"]);
    expect(mockResolveAuthor).not.toHaveBeenCalled();
  });

  it("a category page shows its prose, then its members from ?from= (and strictly after ?after=)", async () => {
    succeeds(article({ title: "Category:Countries" }));
    mockCategoryPage.mockResolvedValue({
      members: [{ title: "Aurelia", namespace: 0 }],
      total: 250,
      next: { sortKey: "Aurelia", title: "Aurelia" },
    });
    const { tree } = await outcome(["Category:Countries"], { from: "Au" });

    expect(mockCategoryPage).toHaveBeenCalledWith({ category: "Countries", from: "Au", after: "" });
    await outcome(["Category:Countries"], { from: "Aurelia", after: "Aurelia" });
    expect(mockCategoryPage).toHaveBeenLastCalledWith({
      category: "Countries",
      from: "Aurelia",
      after: "Aurelia",
    });
    const client = propsOf(tree, "ArticlePageClient");
    expect(client).toMatchObject({ title: "Category:Countries" });
    expect((client?.children as ReactElement).props).toMatchObject({
      total: 250,
      next: { sortKey: "Aurelia", title: "Aurelia" },
      from: "Au",
    });
  });

  it("a category with members but no text of its own is listed, not a 404; an empty one is a 404", async () => {
    fails("NOT_FOUND");
    mockCategoryPage.mockResolvedValue({
      members: [{ title: "Aurelia", namespace: 0 }],
      total: 1,
      next: null,
    });
    const listed = await outcome(["Category:Countries"]);
    expect(listed.signal).toBeNull();
    expect(propsOf(listed.tree, "CategoryMembers")).toMatchObject({ total: 1 });

    mockCategoryPage.mockResolvedValue({ members: [], total: 0, next: null });
    expect((await outcome(["Category:Nothing"])).signal).toBe("not-found");
  });

  it("a file page shows the file above its description; a file with no description page shows the file alone", async () => {
    succeeds(article({ title: "File:Flag.svg" }));
    mockFileInfo.mockResolvedValue({ name: "Flag.svg", url: "https://ixwiki.com/images/Flag.svg" });
    const described = await outcome(["File:Flag.svg"]);
    const client = propsOf(described.tree, "ArticlePageClient");
    expect(isValidElement(client?.aside)).toBe(true);

    fails("NOT_FOUND");
    const bare = await outcome(["File:Flag.svg"]);
    expect(bare.signal).toBeNull();
    expect(propsOf(bare.tree, "FileImage")).toMatchObject({ file: { name: "Flag.svg" } });

    mockFileInfo.mockResolvedValue(null);
    expect((await outcome(["File:Nope.svg"])).signal).toBe("not-found");
  });
});

describe("deleted pages through the route (plan 409)", () => {
  // The route reads as an anonymous viewer, to whom getArticleHtml, getHistory, getPageInfo,
  // getRevisionHtml and getFileInfo answer NOT_FOUND for a deleted (ARCHIVED) page.
  const notFoundError = () => new TRPCError({ code: "NOT_FOUND" });

  it("a deleted article is a 404, in the page and in the metadata", async () => {
    fails("NOT_FOUND");
    expect((await outcome(["Deleted_page"])).signal).toBe("not-found");
    await expect(
      generateMetadata({
        params: Promise.resolve({ slug: ["Deleted_page"] }),
        searchParams: Promise.resolve({}),
      })
    ).rejects.toThrow("not-found");
  });

  it("a deleted user page shows only the profile card, a deleted category page only its members, a deleted file nothing", async () => {
    fails("NOT_FOUND");
    expect(propsOf((await outcome(["User:Jane"])).tree, "UserProfileCard")).toMatchObject({
      pageExists: false,
    });

    mockCategoryPage.mockResolvedValue({
      members: [{ title: "Aurelia", namespace: 0 }],
      total: 1,
      next: null,
    });
    const category = await outcome(["Category:Countries"]);
    expect(named(category.tree, "ArticlePageClient")).toBeUndefined();
    expect(propsOf(category.tree, "CategoryMembers")).toMatchObject({ total: 1 });

    mockFileInfo.mockResolvedValue(null); // getFileInfo leaves a deleted description page's file out
    expect((await outcome(["File:Flag.svg"])).signal).toBe("not-found");
  });

  it("the history, info, revision and diff views of a deleted page are 404s", async () => {
    mockPageInfo.mockRejectedValue(notFoundError());
    expect((await outcome(["Deleted_page"], { action: "info" })).signal).toBe("not-found");

    mockHistory.mockRejectedValue(notFoundError());
    expect((await outcome(["Deleted_page"], { diff: "cur", oldid: "5" })).signal).toBe("not-found");

    fails("NOT_FOUND");
    expect((await outcome(["Deleted_page"], { oldid: "5" })).signal).toBe("not-found");
  });

  it("an old tool slug is a redirect when the article of that name is deleted (it is a red link)", async () => {
    mockMissingPages.mockResolvedValue(["Search"]); // findMissingTitles counts an ARCHIVED page as missing
    expect((await outcome(["search"])).signal).toBe("redirect:/util/search");
  });
});

describe("views of a page (plan 412 step 5)", () => {
  it("?action=history is the history view in place, without reading the article", async () => {
    const { tree } = await outcome(["foo_bar"], { action: "history" });
    // "foo_bar" is not canonical: it moves first, keeping the query.
    expect(tree).toBeNull();

    const ok = await outcome(["Foo_bar/baz"], { action: "history" });
    expect(propsOf(ok.tree, "PageHistoryView")).toMatchObject({
      title: "Foo bar/baz",
      slug: "Foo_bar/baz",
    });
    expect(mockArticlePrefetch).not.toHaveBeenCalled();
  });

  it("?action=info shows the page information, and is a 404 for a page that does not exist", async () => {
    mockPageInfo.mockResolvedValue({ title: "Aurelia" });
    const { tree } = await outcome(["Aurelia"], { action: "info" });
    expect(propsOf(tree, "PageInfoTable")).toMatchObject({ info: { title: "Aurelia" } });

    mockPageInfo.mockRejectedValue(new TRPCError({ code: "NOT_FOUND" }));
    expect((await outcome(["Nowhere"], { action: "info" })).signal).toBe("not-found");
  });

  it("?diff=<ref>&oldid=<ref> is the diff view in place", async () => {
    const { tree } = await outcome(["Aurelia"], { diff: "9", oldid: "5" });
    expect(propsOf(tree, "RevisionDiffView")).toMatchObject({
      fromrev: "5",
      torev: "9",
      backHref: "/wiki/Aurelia",
      backLabel: "Back to Aurelia",
    });
    expect(mockHistory).not.toHaveBeenCalled();
  });

  it("the link of a parked-edit notification (plan 406) opens that edit against the head it conflicted with", async () => {
    // `/wiki/<urlPath>?diff=<the parked edit>&oldid=<the head>`, exactly as inbound-revision-sync writes it.
    for (const href of [
      "/wiki/Foo_bar?diff=95&oldid=90",
      "/wiki/Foo_bar?diff=95&oldid=cm9abc123xyz",
    ]) {
      const url = new URL(href, "https://ixstats.test");
      const slug = url.pathname.replace(/^\/wiki\//, "").split("/");
      const { tree, signal } = await outcome(slug, Object.fromEntries(url.searchParams));
      expect(signal).toBeNull();
      expect(propsOf(tree, "RevisionDiffView")).toMatchObject({
        fromrev: url.searchParams.get("oldid"),
        torev: "95",
      });
    }
  });

  it("?diff=next and ?diff=cur are worked out from the page's history", async () => {
    mockHistory.mockResolvedValue({
      revisions: [{ revid: "9" }, { revid: "7" }, { revid: "5" }],
    });

    const next = await outcome(["Aurelia"], { diff: "next", oldid: "5" });
    expect(mockHistory).toHaveBeenCalledWith({ title: "Aurelia", limit: 100 });
    expect(propsOf(next.tree, "RevisionDiffView")).toMatchObject({ fromrev: "5", torev: "7" });

    const cur = await outcome(["Aurelia"], { diff: "cur", oldid: "5" });
    expect(propsOf(cur.tree, "RevisionDiffView")).toMatchObject({ fromrev: "5", torev: "9" });

    // Nothing comes after the newest revision.
    expect((await outcome(["Aurelia"], { diff: "next", oldid: "9" })).signal).toBe("not-found");
  });

  it("?diff=prev&oldid=N is the change N made", async () => {
    const { tree } = await outcome(["Aurelia"], { diff: "prev", oldid: "5" });
    expect(propsOf(tree, "RevisionDiffView")).toMatchObject({ fromrev: undefined, torev: "5" });
    expect((await outcome(["Aurelia"], { diff: "prev" })).signal).toBe("not-found");
  });

  it("?oldid=<ref> is the old revision, primed for the client", async () => {
    mockRevisionPrefetch.mockResolvedValue(undefined);
    mockPrefetchedState.mockReturnValue({
      status: "success",
      data: { title: "Aurelia", timestamp: "2026-01-01T00:00:00.000Z" },
    });
    const { tree, signal } = await outcome(["Aurelia"], { oldid: "5" });

    expect(signal).toBeNull();
    expect(mockRevisionPrefetch).toHaveBeenCalledWith({ ref: "5" }, { retry: false });
    expect(propsOf(tree, "RevisionView")).toMatchObject({ revisionRef: "5", title: "Aurelia" });
  });

  it("a revision of another page moves to that page; a missing revision is a 404", async () => {
    mockPrefetchedState.mockReturnValue({
      status: "success",
      data: { title: "Other page", timestamp: "2026-01-01T00:00:00.000Z" },
    });
    expect((await outcome(["Aurelia"], { oldid: "5" })).signal).toBe(
      "permanent:/wiki/Other_page?oldid=5"
    );

    fails("NOT_FOUND");
    expect((await outcome(["Aurelia"], { oldid: "404" })).signal).toBe("not-found");
    fails("PRECONDITION_FAILED");
    expect((await outcome(["Aurelia"], { oldid: "405" })).signal).toBe("not-found");
  });
});

describe("generateMetadata (plan 412 step 2)", () => {
  const metadata = (slug: string[], query: Query = {}) =>
    generateMetadata({ params: Promise.resolve({ slug }), searchParams: Promise.resolve(query) });

  it("gives an article its title, description, canonical URL and link card", async () => {
    succeeds(
      article({
        title: "Portal:Eurth",
        infoboxHtml:
          '<table class="infobox"><tr><td><img src="https://ixwiki.com/images/a/ab/Eurth.png"></td></tr></table>',
      })
    );
    const result = await metadata(["Portal:Eurth"]);

    expect(result.title).toBe("Portal:Eurth");
    expect(result.description).toMatch(/^Aurelia is a country of Eurth/);
    expect(result.alternates?.canonical).toBe("https://ixwiki.com/wiki/Portal:Eurth");
    expect(result.openGraph).toMatchObject({
      type: "article",
      url: "https://ixwiki.com/wiki/Portal:Eurth",
      // The image proxy of this site, which serves it from the public host.
      images: [{ url: "https://ixwiki.com/api/mediawiki/ixwiki/images/a/ab/Eurth.png" }],
    });
    expect(result.twitter).toMatchObject({ card: "summary_large_image" });
  });

  it("points a case variant at the page's real title", async () => {
    succeeds(article({ title: "NATO" }));
    const result = await metadata(["Nato"]);
    expect(result.alternates?.canonical).toBe("https://ixwiki.com/wiki/NATO");
  });

  it("a page that does not exist is notFound() in the metadata too: crawlers get the real 404", async () => {
    fails("NOT_FOUND");
    await expect(metadata(["Nowhere"])).rejects.toThrow("not-found");
    await expect(metadata(["a%5Bb"])).rejects.toThrow("not-found");
    await expect(metadata(["Special:NoSuchThing"])).rejects.toThrow("not-found");
  });

  it("indexes a category page even with no text of its own", async () => {
    fails("NOT_FOUND");
    await expect(metadata(["Category:Countries"])).resolves.toMatchObject({
      title: "Category:Countries",
      alternates: { canonical: "https://ixwiki.com/wiki/Category:Countries" },
    });
  });

  it("does not index the edit, history, diff, revision and info views, and points them at the article", async () => {
    for (const query of [
      { action: "edit" },
      { action: "history" },
      { action: "info" },
      { oldid: "5" },
      { diff: "9", oldid: "5" },
    ]) {
      await expect(metadata(["Aurelia"], query)).resolves.toEqual({
        title: "Aurelia",
        alternates: { canonical: "https://ixwiki.com/wiki/Aurelia" },
        robots: { index: false, follow: false },
      });
    }
    expect(mockArticlePrefetch).not.toHaveBeenCalled();
  });

  it("has none for a redirect page, a non-canonical URL, the Main Page, another wiki's page and the special routes", async () => {
    succeeds(article({ title: "New name", resolvedFrom: "Old name" }));
    await expect(metadata(["Old_name"])).resolves.toEqual({});
    await expect(metadata(["foo_bar"])).resolves.toEqual({});
    await expect(metadata(["Main_Page"])).resolves.toEqual({});
    await expect(metadata(["Foo"], { source: "iiwiki" })).resolves.toEqual({});
    await expect(metadata(["Special:Random"])).resolves.toEqual({});
  });

  it("keeps the canonical link when the lookup is busy", async () => {
    fails("TOO_MANY_REQUESTS");
    await expect(metadata(["Aurelia"])).resolves.toEqual({
      alternates: { canonical: "https://ixwiki.com/wiki/Aurelia" },
    });
  });
});
