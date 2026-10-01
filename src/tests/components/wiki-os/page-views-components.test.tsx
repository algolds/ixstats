/** Plan 412: the page furniture of the /wiki/<path> route: tabs, notices, lists and the 404. */
import type { ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";

const mockPush = jest.fn();
let mockPathname = "/wiki/Foo";
let mockSignedIn = true;
jest.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
  useRouter: () => ({ push: mockPush }),
}));
jest.mock("~/lib/wiki-os/use-wiki-auth", () => ({
  useWikiAuth: () => ({ isSignedIn: mockSignedIn, isLoaded: true }),
}));
jest.mock("~/components/wiki-os/shared/WikiOSLayout", () => ({
  WikiOSLayout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
const mockResolveAuthor = jest.fn();
const mockPermissions = jest.fn();
jest.mock("~/trpc/react", () => ({
  api: {
    users: { resolveWikiAuthor: { useQuery: (...a: unknown[]) => mockResolveAuthor(...a) } },
    wikios: {
      getUserPermissions: { useQuery: (...a: unknown[]) => mockPermissions(...a) },
      getRevisionHtml: {
        useQuery: () => ({ data: undefined, error: null, refetch: jest.fn() }),
      },
    },
  },
}));
jest.mock("~/components/shared/flags/UnifiedCountryFlag", () => ({
  UnifiedCountryFlag: ({ countryName }: { countryName: string }) => <i>{countryName} flag</i>,
}));

import { ArticleTabs } from "~/components/wiki-os/reader/ArticleTabs";
import { CategoryMembers } from "~/components/wiki-os/reader/CategoryMembers";
import { PageInfoTable } from "~/components/wiki-os/reader/PageInfoTable";
import { PageList } from "~/components/wiki-os/reader/PageList";
import { FileDetails } from "~/components/wiki-os/reader/FileDetails";
import { FileImage } from "~/components/wiki-os/reader/FileImage";
import { UserProfileCard } from "~/components/wiki-os/reader/UserProfileCard";
import { DeletedPageLinks } from "~/components/wiki-os/reader/DeletedPageLinks";
import WikiNotFound from "~/app/(wiki-os)/wiki/[...slug]/not-found";

beforeEach(() => {
  jest.clearAllMocks();
  mockPathname = "/wiki/Foo";
  mockSignedIn = true;
  mockResolveAuthor.mockReturnValue({ data: null });
  mockPermissions.mockReturnValue({ data: { rights: [] } });
});

describe("ArticleTabs (Page / Discussion)", () => {
  it("links a page to its talk page, with the page tab current", () => {
    render(<ArticleTabs title="Foo bar" />);

    expect(screen.getByRole("link", { name: "Page" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Discussion" })).toHaveAttribute(
      "href",
      "/wiki/Talk:Foo_bar"
    );
    expect(screen.queryByRole("link", { name: "Add topic" })).not.toBeInTheDocument();
  });

  it("on a talk page the Discussion tab is current and Add topic opens the editor on a new section", () => {
    render(<ArticleTabs title="User talk:Jane" />);

    expect(screen.getByRole("link", { name: "Discussion" })).toHaveAttribute(
      "aria-current",
      "page"
    );
    expect(screen.getByRole("link", { name: "Page" })).toHaveAttribute("href", "/wiki/User:Jane");
    expect(screen.getByRole("link", { name: "Add topic" })).toHaveAttribute(
      "href",
      "/wiki/User_talk:Jane?action=edit&section=new"
    );
  });

  it("shows nothing for a page with no talk namespace", () => {
    const { container } = render(<ArticleTabs title="Special:Random" />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("the 404 page", () => {
  it("names the page the URL asked for, and offers to create it to a signed-in reader", () => {
    mockPathname = "/wiki/foo_bar/baz";
    render(<WikiNotFound />);

    expect(screen.getByText(/Foo bar\/baz/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /create this page/i }));
    expect(mockPush).toHaveBeenCalledWith("/wiki/Foo_bar/baz?action=edit");
  });

  it("offers no creation to a signed-out reader, nor for a Special: page or a title MediaWiki refuses", () => {
    mockSignedIn = false;
    const { unmount } = render(<WikiNotFound />);
    expect(screen.queryByRole("button", { name: /create this page/i })).not.toBeInTheDocument();
    unmount();

    mockSignedIn = true;
    mockPathname = "/wiki/Special:NoSuchThing";
    const special = render(<WikiNotFound />);
    expect(screen.queryByRole("button", { name: /create this page/i })).not.toBeInTheDocument();
    special.unmount();

    mockPathname = "/wiki/a%5Bb";
    render(<WikiNotFound />);
    expect(screen.queryByRole("button", { name: /create this page/i })).not.toBeInTheDocument();
  });
});

describe("CategoryMembers", () => {
  const members = [
    { title: "Category:Islands", namespace: 14 },
    { title: "Aurelia", namespace: 0 },
    { title: "Template:Flag", namespace: 10 },
    { title: "File:Flag.svg", namespace: 6 },
  ];

  it("splits the members into subcategories, pages and files, each linking to its page", () => {
    render(
      <CategoryMembers title="Category:Countries" members={members} total={4} from="" next={null} />
    );

    expect(screen.getByRole("heading", { name: "Subcategories" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Islands" })).toHaveAttribute(
      "href",
      "/wiki/Category:Islands"
    );
    expect(screen.getByRole("heading", { name: /Pages in category/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Aurelia" })).toHaveAttribute("href", "/wiki/Aurelia");
    expect(screen.getByRole("link", { name: "Template:Flag" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Media in this category" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "File:Flag.svg" })).toHaveAttribute(
      "href",
      "/wiki/File:Flag.svg"
    );
    expect(screen.getByText("4 members.")).toBeInTheDocument();
  });

  it("links to the next page (?from=) and back to the first", () => {
    render(
      <CategoryMembers
        title="Category:Countries"
        members={members}
        total={450}
        from="Au"
        next={{ sortKey: "Borea Sea", title: "Borea Sea (country)" }}
      />
    );

    expect(screen.getByText(/Showing 4 of 450 members, starting at “Au”/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Next page" })).toHaveAttribute(
      "href",
      "/wiki/Category:Countries?from=Borea+Sea&after=Borea+Sea+%28country%29"
    );
    expect(screen.getByRole("link", { name: "First page" })).toHaveAttribute(
      "href",
      "/wiki/Category:Countries"
    );
  });

  it("says so when the category has no members", () => {
    render(<CategoryMembers title="Category:Empty" members={[]} total={0} from="" next={null} />);
    expect(screen.getByText(/no members/)).toBeInTheDocument();
  });
});

describe("PageList (Special:AllPages, Special:PrefixIndex)", () => {
  it("lists pages, marks redirects, and links to the next page with the query it was asked with", () => {
    render(
      <PageList
        pages={[
          { title: "Aurelia", isRedirect: false },
          { title: "Aurelian Sea", isRedirect: true },
        ]}
        next="Aurora"
        from=""
        specialPath="Special:PrefixIndex"
        query={{ namespace: "0", prefix: "Aur" }}
      />
    );

    expect(screen.getByRole("link", { name: "Aurelian Sea" })).toHaveClass("italic");
    expect(screen.getByRole("link", { name: "Aurelia" })).not.toHaveClass("italic");
    expect(screen.getByRole("link", { name: "Next page" })).toHaveAttribute(
      "href",
      "/wiki/Special:PrefixIndex?namespace=0&prefix=Aur&from=Aurora"
    );
    expect(screen.queryByRole("link", { name: "First page" })).not.toBeInTheDocument();
  });

  it("says so when nothing matches", () => {
    render(<PageList pages={[]} next={null} from="" specialPath="Special:AllPages" query={{}} />);
    expect(screen.getByText("No pages match.")).toBeInTheDocument();
  });
});

describe("PageInfoTable (?action=info)", () => {
  it("shows the facts about a page", () => {
    render(
      <PageInfoTable
        info={{
          title: "Foo bar",
          namespace: 0,
          pageId: 42,
          length: 1234,
          wordCount: 200,
          created: { at: new Date("2020-01-02T03:04:00Z"), by: "Old Hand" },
          lastEdited: { at: new Date("2026-09-01T10:00:00Z"), by: null },
          revisionCount: 57,
          redirectCount: 3,
          categoryCount: 6,
          protectionLevel: "SYSOP",
          protectionExpiry: null,
          redirectsTo: null,
        }}
      />
    );

    expect(screen.getByText("1,234")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText(/2 January 2020.*03:04 UTC by Old Hand/)).toBeInTheDocument();
    expect(screen.getByText("sysop")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Back to Foo bar/ })).toHaveAttribute(
      "href",
      "/wiki/Foo_bar"
    );
  });
});

describe("FileImage", () => {
  it("shows the file with its facts, large and eager", () => {
    render(
      <FileImage
        file={{
          name: "Flag of Eurth.svg",
          url: "https://ixwiki.com/images/a/ab/Flag.svg",
          thumbUrl: null,
          width: 300,
          height: 200,
          mimeType: "image/svg+xml",
          sizeBytes: 2048,
        }}
      />
    );

    const image = screen.getByRole("img", { name: "Flag of Eurth.svg" });
    expect(image).toHaveAttribute("src", "https://ixwiki.com/images/a/ab/Flag.svg");
    expect(image).toHaveAttribute("fetchpriority", "high");
    expect(screen.getByText(/300 × 200 pixels, 2 KB, image\/svg\+xml/)).toBeInTheDocument();
  });
});

describe("FileImage for a PDF (plan 411)", () => {
  it("links the file instead of showing a picture", () => {
    render(
      <FileImage
        file={{
          name: "Treaty of Eurth.pdf",
          url: "/api/wiki/file/Treaty_of_Eurth.pdf",
          thumbUrl: null,
          width: null,
          height: null,
          mimeType: "application/pdf",
          sizeBytes: 90000,
        }}
      />
    );

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Download Treaty of Eurth.pdf" })).toHaveAttribute(
      "href",
      "/api/wiki/file/Treaty_of_Eurth.pdf"
    );
    expect(screen.getByText(/88 KB, application\/pdf/)).toBeInTheDocument();
  });
});

describe("FileDetails (plan 411)", () => {
  const version = (over: Record<string, unknown> = {}) => ({
    at: "2026-09-30T12:05:00.000Z",
    user: "Jane Doe",
    comment: "A better flag",
    action: "overwrite",
    width: 640,
    height: 480,
    size: 5120,
    mime: "image/png",
    ...over,
  });

  it("lists the upload history, newest first and marked current, with who uploaded each version", () => {
    render(
      <FileDetails
        details={{
          history: [
            version(),
            version({
              at: "2026-09-01T08:30:00.000Z",
              user: "Mod",
              comment: null,
              width: null,
              height: null,
              size: null,
            }),
          ],
          usage: [],
          usageTotal: 0,
        }}
      />
    );

    expect(screen.getByRole("heading", { name: "File history" })).toBeInTheDocument();
    const rows = screen.getAllByRole("row").slice(1);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent("30 Sept 2026, 12:05 UTC (current)");
    expect(rows[0]).toHaveTextContent("640 × 480");
    expect(rows[0]).toHaveTextContent("5 KB");
    expect(rows[0]).toHaveTextContent("A better flag");
    expect(rows[1]).toHaveTextContent("1 Sept 2026, 08:30 UTC");
    expect(rows[1]).not.toHaveTextContent("(current)");
    expect(screen.getByRole("link", { name: "Jane Doe" })).toHaveAttribute(
      "href",
      "/wiki/User:Jane_Doe"
    );
  });

  it("shows no history table for a file WikiOS has no upload log of", () => {
    render(<FileDetails details={{ history: [], usage: [], usageTotal: 0 }} />);

    expect(screen.queryByRole("heading", { name: "File history" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "File usage" })).toBeInTheDocument();
    expect(screen.getByText("No pages use this file.")).toBeInTheDocument();
  });

  it("links the pages that use the file, and says how many more there are", () => {
    render(
      <FileDetails
        details={{
          history: [],
          usage: [
            { title: "Eurth", urlPath: "Eurth" },
            { title: "Flags of the world", urlPath: "Flags_of_the_world" },
          ],
          usageTotal: 340,
        }}
      />
    );

    expect(screen.getByRole("link", { name: "Flags of the world" })).toHaveAttribute(
      "href",
      "/wiki/Flags_of_the_world"
    );
    expect(screen.getByText(/These 340 pages use this file/)).toBeInTheDocument();
    expect(screen.getByText(/Showing the first 2 of 340/)).toBeInTheDocument();
  });

  it("says a single page uses it", () => {
    render(
      <FileDetails
        details={{ history: [], usage: [{ title: "Eurth", urlPath: "Eurth" }], usageTotal: 1 }}
      />
    );

    expect(screen.getByText(/This page uses this file/)).toBeInTheDocument();
  });
});

describe("UserProfileCard", () => {
  it("shows the user's country and links to the passport and contributions", () => {
    mockResolveAuthor.mockReturnValue({
      data: { country: { name: "Aurelia", flag: "x", continent: "Eurth" } },
    });
    render(<UserProfileCard username="Jane Doe" pageExists />);

    expect(screen.getByText("Aurelia · Eurth")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Contributions/ })).toHaveAttribute(
      "href",
      "/util/contributions/Jane%20Doe"
    );
    expect(screen.getByRole("link", { name: /IxnayID profile/ })).toHaveAttribute(
      "href",
      "/@Jane%20Doe?tab=work"
    );
    expect(screen.queryByText(/no user page yet/)).not.toBeInTheDocument();
  });

  it("says when the user has no user page yet", () => {
    render(<UserProfileCard username="Jane" pageExists={false} />);
    expect(screen.getByText("This user has no user page yet.")).toBeInTheDocument();
  });
});

describe("DeletedPageLinks (plan 409: only a reader with deletedhistory can know a page was deleted)", () => {
  it("points a reader with deletedhistory and undelete at the deletion log and the undelete screen", () => {
    mockPermissions.mockReturnValue({ data: { rights: ["deletedhistory", "undelete"] } });
    render(<DeletedPageLinks title="Foo bar" enabled />);

    expect(screen.getByRole("link", { name: "deletion log" })).toHaveAttribute(
      "href",
      "/util/log?title=Foo%20bar&type=delete"
    );
    expect(screen.getByRole("link", { name: "restore it" })).toHaveAttribute(
      "href",
      "/util/undelete?title=Foo%20bar"
    );
  });

  it("offers only the log to a reader who cannot undelete", () => {
    mockPermissions.mockReturnValue({ data: { rights: ["deletedhistory"] } });
    render(<DeletedPageLinks title="Foo" enabled />);

    expect(screen.getByRole("link", { name: "deletion log" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "restore it" })).not.toBeInTheDocument();
  });

  it("shows nothing to everyone else: to them the page does not exist", () => {
    mockPermissions.mockReturnValue({ data: { rights: ["read", "edit"] } });
    const { container } = render(<DeletedPageLinks title="Foo" enabled />);
    expect(container).toBeEmptyDOMElement();
  });

  it("is on the 404 page, for the title the URL named", () => {
    mockPathname = "/wiki/foo_bar";
    mockPermissions.mockReturnValue({ data: { rights: ["deletedhistory"] } });
    render(<WikiNotFound />);
    expect(screen.getByRole("link", { name: "deletion log" })).toHaveAttribute(
      "href",
      "/util/log?title=Foo%20bar&type=delete"
    );
  });
});
