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
jest.mock("~/trpc/server", () => ({
  __esModule: true,
  api: {
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

  it("an unknown special page is a 404, not a redirect to the utilities", async () => {
    expect((await outcome(["Special:NoSuchThing"])).signal).toBe("not-found");
    expect((await outcome(["Special:Log"])).signal).toBe("not-found"); // plan 409 adds it
  });

  it("?action=raw that reached the page (the proxy rewrite did not) goes to the raw route", async () => {
    expect((await outcome(["Foo_bar"], { action: "raw" })).signal).toBe(
      "redirect:/api/wiki/raw?title=Foo%20bar"
    );
    expect((await outcome(["Foo"], { action: "raw", oldid: "77" })).signal).toBe(
      "redirect:/api/wiki/raw?title=Foo&oldid=77"
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
    expect(propsOf(tree, "UserProfileCard")).toMatchObject({ username: "Jane", pageExists: false });
    expect(named(tree, "ArticlePageClient")).toBeUndefined();

    expect((await outcome(["User:Jane", "Nothing"])).signal).toBe("not-found");
  });

  it("a category page shows its prose, then its members from ?from=", async () => {
    succeeds(article({ title: "Category:Countries" }));
    mockCategoryPage.mockResolvedValue({
      members: [{ title: "Aurelia", namespace: 0 }],
      total: 250,
      next: "Borea",
    });
    const { tree } = await outcome(["Category:Countries"], { from: "Au" });

    expect(mockCategoryPage).toHaveBeenCalledWith({ category: "Countries", from: "Au" });
    const client = propsOf(tree, "ArticlePageClient");
    expect(client).toMatchObject({ title: "Category:Countries" });
    expect((client?.children as ReactElement).props).toMatchObject({
      total: 250,
      next: "Borea",
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

  it("does not index a page that does not exist", async () => {
    fails("NOT_FOUND");
    await expect(metadata(["Nowhere"])).resolves.toEqual({
      robots: { index: false, follow: false },
    });
  });

  it("indexes a category, user or file page even with no text of its own", async () => {
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
    await expect(metadata(["a%5Bb"])).resolves.toEqual({});
  });

  it("keeps the canonical link when the lookup is busy", async () => {
    fails("TOO_MANY_REQUESTS");
    await expect(metadata(["Aurelia"])).resolves.toEqual({
      alternates: { canonical: "https://ixwiki.com/wiki/Aurelia" },
    });
  });
});
