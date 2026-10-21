/** Plan 412: the page furniture of the /wiki/<path> route: tabs, notices, lists and the 404. */
import type { ReactNode } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";

let mockPathname = "/wiki/Foo";
let mockSignedIn = true;
jest.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
}));
jest.mock("~/lib/wiki-os/use-wiki-auth", () => ({
  useWikiAuth: () => ({ isSignedIn: mockSignedIn, isLoaded: true }),
}));
jest.mock("~/components/wiki-os/shared/WikiOSLayout", () => ({
  WikiOSLayout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
const mockResolveAuthor = jest.fn();
const mockPermissions = jest.fn();
const mockEditAccess = jest.fn();
jest.mock("~/trpc/react", () => ({
  api: {
    users: { resolveWikiAuthor: { useQuery: (...a: unknown[]) => mockResolveAuthor(...a) } },
    wikios: {
      getUserPermissions: { useQuery: (...a: unknown[]) => mockPermissions(...a) },
      getEditAccess: { useQuery: (...a: unknown[]) => mockEditAccess(...a) },
      getRevisionHtml: {
        useQuery: () => ({ data: undefined, error: null, refetch: jest.fn() }),
      },
    },
  },
}));
jest.mock("~/components/shared/flags/UnifiedCountryFlag", () => ({
  UnifiedCountryFlag: ({ countryName }: { countryName: string }) => <i>{countryName} flag</i>,
}));

import { CategoryMembers } from "~/components/wiki-os/reader/CategoryMembers";
import { PageList } from "~/components/wiki-os/reader/PageList";
import { FileImage } from "~/components/wiki-os/reader/FileImage";
import { DeletedPageLinks } from "~/components/wiki-os/reader/DeletedPageLinks";
import WikiNotFound from "~/app/(wiki-os)/wiki/[...slug]/not-found";

beforeEach(() => {
  jest.clearAllMocks();
  mockPathname = "/wiki/Foo";
  mockSignedIn = true;
  mockResolveAuthor.mockReturnValue({ data: null });
  mockPermissions.mockReturnValue({ data: { rights: [] } });
  mockEditAccess.mockReturnValue({ data: { allowed: true, reason: null } });
});

describe("the 404 page", () => {
  it("names the page the URL asked for, says there is no text, and offers a signed-in reader who may create it a link to the editor", () => {
    mockPathname = "/wiki/foo_bar/baz";
    render(<WikiNotFound />);

    expect(screen.getByRole("heading", { level: 1, name: "Foo bar/baz" })).toBeInTheDocument();
    expect(screen.getByText("There is currently no text in this page.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /create this page/i })).toHaveAttribute(
      "href",
      "/wiki/Foo_bar/baz?action=edit&redlink=1"
    );
    expect(screen.getByRole("link", { name: /search for this title/i })).toHaveAttribute(
      "href",
      "/util/search?q=Foo%20bar%2Fbaz"
    );
    expect(mockEditAccess).toHaveBeenCalledWith(
      { title: "Foo bar/baz" },
      expect.objectContaining({ enabled: true })
    );
  });

  it("offers no creation to a signed-out reader, nor for a Special: page or a title MediaWiki refuses", () => {
    mockSignedIn = false;
    const { unmount } = render(<WikiNotFound />);
    expect(screen.queryByRole("link", { name: /create this page/i })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /search for this title/i })).toBeInTheDocument();
    unmount();

    mockSignedIn = true;
    mockPathname = "/wiki/Special:NoSuchThing";
    const special = render(<WikiNotFound />);
    expect(screen.queryByRole("link", { name: /create this page/i })).not.toBeInTheDocument();
    special.unmount();

    mockPathname = "/wiki/a%5Bb";
    render(<WikiNotFound />);
    expect(screen.queryByRole("link", { name: /create this page/i })).not.toBeInTheDocument();
  });

  it("offers no creation to a signed-in reader the server says may not create the page (protected, blocked, namespace)", () => {
    mockPathname = "/wiki/Template:Flag";
    mockEditAccess.mockReturnValue({ data: { allowed: false, reason: "namespace" } });
    render(<WikiNotFound />);
    expect(screen.queryByRole("link", { name: /create this page/i })).not.toBeInTheDocument();

    mockEditAccess.mockReturnValue({ data: undefined });
    cleanup();
    render(<WikiNotFound />);
    // not yet known: no link rather than a link that may lead to a refusal
    expect(screen.queryByRole("link", { name: /create this page/i })).not.toBeInTheDocument();
  });

  it("is in the HTML the server renders: heading, message and search link, with no create link for the anonymous render", () => {
    mockSignedIn = false;
    mockPathname = "/wiki/Nowhere_land";
    const html = renderToString(<WikiNotFound />);

    expect(html).toMatch(/<h1[^>]*>Nowhere land<\/h1>/);
    expect(html).toContain("There is currently no text in this page.");
    expect(html).toContain('href="/util/search?q=Nowhere%20land"');
    expect(html).not.toMatch(/create this page/i);
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
          blurhash: null,
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
