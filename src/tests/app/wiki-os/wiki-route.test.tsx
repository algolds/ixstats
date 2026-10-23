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
const mockMainPagePrefetch = jest.fn();
const mockRevisionPrefetch = jest.fn();
const mockPrefetchedState = jest.fn();
const mockRandomPage = jest.fn();
const mockFileInfo = jest.fn();
const mockFileDetails = jest.fn();
const mockCategoryPage = jest.fn();
const mockListPages = jest.fn();
const mockPageInfo = jest.fn();
const mockHistory = jest.fn();
const mockResolveAuthor = jest.fn();
const mockUserPageOwner = jest.fn();
const mockParentCategoriesPrefetch = jest.fn();
const mockAwardsPrefetch = jest.fn();
const mockCountryPrefetch = jest.fn();
jest.mock("~/trpc/server", () => ({
  __esModule: true,
  api: {
    users: {
      resolveWikiAuthor: (...args: unknown[]) => mockResolveAuthor(...args),
      wikiUserPageOwner: (...args: unknown[]) => mockUserPageOwner(...args),
    },
    lorewards: {
      getArticleAwardsAndAchievements: {
        prefetch: (...args: unknown[]) => mockAwardsPrefetch(...args),
      },
    },
    countries: { getByIdBasic: { prefetch: (...args: unknown[]) => mockCountryPrefetch(...args) } },
    wikios: {
      getParentCategories: {
        prefetch: (...args: unknown[]) => mockParentCategoriesPrefetch(...args),
      },
      getArticleHtml: { prefetch: (...args: unknown[]) => mockArticlePrefetch(...args) },
      getMainPage: { prefetch: (...args: unknown[]) => mockMainPagePrefetch(...args) },
      getRevisionHtml: { prefetch: (...args: unknown[]) => mockRevisionPrefetch(...args) },
      getRandomPage: (...args: unknown[]) => mockRandomPage(...args),
      getFileInfo: (...args: unknown[]) => mockFileInfo(...args),
      getFileDetails: (...args: unknown[]) => mockFileDetails(...args),
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
  mockCategoryPage.mockResolvedValue({ members: [], total: 0, next: null });
  mockFileInfo.mockResolvedValue(null);
  mockFileDetails.mockResolvedValue(null);
  mockResolveAuthor.mockResolvedValue({ wikiUsername: "Jane" });
  mockUserPageOwner.mockResolvedValue(null);
});

describe("an article is read on the server (plan 412 step 2)", () => {
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
  it("a busy or failed lookup is not a 404: the client asks again", async () => {
    fails("TOO_MANY_REQUESTS");
    const { tree, signal } = await outcome(["Aurelia"]);

    expect(signal).toBeNull();
    expect(mockNotFound).not.toHaveBeenCalled();
    expect(propsOf(tree, "ArticlePageClient")).toMatchObject({ title: "Aurelia" });
  });
});

describe("User: pages open the owner's passport (IxnayID design decision 10)", () => {
  it("a shown claim's user page is a temporary redirect to the owner's passport, before any article read", async () => {
    mockUserPageOwner.mockResolvedValue({ handle: "alpha" });

    expect((await outcome(["User:Old_name"])).signal).toBe("redirect:/@alpha");
    expect(mockUserPageOwner).toHaveBeenCalledWith({ name: "Old name" });
    expect(mockPermanentRedirect).not.toHaveBeenCalled();
    expect(mockArticlePrefetch).not.toHaveBeenCalled();
  });

  it("a handle's user page opens that handle's passport", async () => {
    mockUserPageOwner.mockResolvedValue({ handle: "foo_bar" });

    expect((await outcome(["User:Foo_bar"])).signal).toBe("redirect:/@foo_bar");
    expect(mockUserPageOwner).toHaveBeenCalledWith({ name: "Foo bar" });
  });

  it("an unclaimed or hidden name's page renders as before: its text and the profile card", async () => {
    succeeds(article({ title: "User:Old name" }));
    const { tree, signal } = await outcome(["User:Old_name"]);

    expect(signal).toBeNull();
    expect(propsOf(tree, "ArticlePageClient")).toMatchObject({ title: "User:Old name" });
  });

  it("a hidden claim's page with no text is a 404, as for a name nobody holds: the owner is never told", async () => {
    fails("NOT_FOUND");
    mockResolveAuthor.mockResolvedValue(null);

    expect((await outcome(["User:Old_name"])).signal).toBe("not-found");
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("never redirects a subpage or a user talk page", async () => {
    mockUserPageOwner.mockResolvedValue({ handle: "alpha" });

    expect((await outcome(["User:Old_name", "Sandbox"])).signal).toBeNull();
    expect((await outcome(["User_talk:Old_name"])).signal).toBeNull();
    expect(mockUserPageOwner).not.toHaveBeenCalled();
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("leaves the editor and the history alone, so the old text stays reachable", async () => {
    mockUserPageOwner.mockResolvedValue({ handle: "alpha" });
    mockHistory.mockResolvedValue({ revisions: [], hasMore: false });

    expect((await outcome(["User:Old_name"], { action: "edit" })).signal).toBeNull();
    expect((await outcome(["User:Old_name"], { action: "history" })).signal).toBeNull();
    expect(mockUserPageOwner).not.toHaveBeenCalled();
  });

  it("a failed owner lookup renders the page as before", async () => {
    mockUserPageOwner.mockRejectedValue(new TRPCError({ code: "TOO_MANY_REQUESTS" }));

    const { tree, signal } = await outcome(["User:Old_name"]);
    expect(signal).toBeNull();
    expect(propsOf(tree, "ArticlePageClient")).not.toBeNull();
  });
});

describe("Special: pages (plan 412 step 3)", () => {
  it("an input the procedures refuse (a title or cursor too long to be one) is a 404, not a 500", async () => {
    const refused = new TRPCError({ code: "BAD_REQUEST" });
    mockListPages.mockRejectedValue(refused);
    expect((await outcome(["Special:AllPages"], { from: "x".repeat(300) })).signal).toBe(
      "not-found"
    );
    mockFileInfo.mockRejectedValue(refused);
    expect((await outcome(["Special:FilePath", "x".repeat(300)])).signal).toBe("not-found");
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
  it("the history, info, revision and diff views of a deleted page are 404s", async () => {
    mockPageInfo.mockRejectedValue(notFoundError());
    expect((await outcome(["Deleted_page"], { action: "info" })).signal).toBe("not-found");

    mockHistory.mockRejectedValue(notFoundError());
    expect((await outcome(["Deleted_page"], { diff: "cur", oldid: "5" })).signal).toBe("not-found");

    fails("NOT_FOUND");
    expect((await outcome(["Deleted_page"], { oldid: "5" })).signal).toBe("not-found");
  });
});
describe("generateMetadata (plan 412 step 2)", () => {
  const metadata = (slug: string[], query: Query = {}) =>
    generateMetadata({ params: Promise.resolve({ slug }), searchParams: Promise.resolve(query) });
  it("a page that does not exist is notFound() in the metadata too: crawlers get the real 404", async () => {
    fails("NOT_FOUND");
    await expect(metadata(["Nowhere"])).rejects.toThrow("not-found");
    await expect(metadata(["a%5Bb"])).rejects.toThrow("not-found");
    await expect(metadata(["Special:NoSuchThing"])).rejects.toThrow("not-found");
  });
});
