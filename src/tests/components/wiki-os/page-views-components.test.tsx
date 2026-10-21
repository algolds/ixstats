/** Plan 412: the page furniture of the /wiki/<path> route: tabs, notices, lists and the 404. */
import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
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
