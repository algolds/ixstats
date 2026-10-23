import type { ReactNode } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { RealmSearch } from "~/app/realms/_components/RealmSearch";
import { YourRealms } from "~/app/realms/_components/YourRealms";
import { RealmFeed } from "~/app/r/[realm]/_components/RealmFeed";
import type { DirectoryRealm } from "~/app/realms/_components/realm-directory";

const mockSearchNations = jest.fn();
const mockGetFeed = jest.fn();

jest.mock("~/trpc/react", () => ({
  api: {
    realms: {
      searchNations: {
        useQuery: (input: { query: string }, options: { enabled: boolean }) =>
          mockSearchNations(input, options),
      },
    },
    thinkpages: {
      getFeed: { useQuery: (input: object) => mockGetFeed(input) },
    },
  },
}));

jest.mock("~/hooks/useDebounce", () => ({ useDebounce: (value: string) => value }));
jest.mock("~/context/auth-context", () => ({ useUser: () => ({ user: { id: "u1" } }) }));

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

jest.mock("~/app/r/[realm]/_components/PlayAsNation", () => ({
  PlayAsNation: ({ countryName }: { countryName: string }) => (
    <button type="button">Play as {countryName}</button>
  ),
}));
jest.mock("~/app/r/[realm]/_components/RealmBoardBlock", () => ({
  RealmBoardBlock: () => <div>board block</div>,
}));
jest.mock("~/components/thinkpages/ThinkpagesPost", () => ({
  ThinkpagesPost: ({ post }: { post: { id: string } }) => <article>full {post.id}</article>,
}));

beforeEach(() => {
  mockSearchNations.mockReset();
  mockSearchNations.mockReturnValue({ data: undefined, isLoading: false });
  mockGetFeed.mockReset();
});

describe("RealmSearch", () => {
  it("typing reports the query", () => {
    const onQueryChange = jest.fn();
    render(<RealmSearch query="" onQueryChange={onQueryChange} />);
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "eu" } });
    expect(onQueryChange).toHaveBeenCalledWith("eu");
  });

  it("nations list from two characters", () => {
    mockSearchNations.mockImplementation((_input, options: { enabled: boolean }) => ({
      data: options.enabled
        ? [
            {
              kind: "country",
              id: "c1",
              slug: "caphiria",
              name: "Caphiria",
              flag: null,
              claimable: true,
              realm: { slug: "ixnay", name: "Ixnay" },
            },
          ]
        : undefined,
      isLoading: false,
    }));
    const { rerender } = render(<RealmSearch query="c" onQueryChange={jest.fn()} />);
    expect(mockSearchNations).toHaveBeenLastCalledWith({ query: "c" }, { enabled: false });
    expect(screen.queryByText("Caphiria")).toBeNull();

    rerender(<RealmSearch query="ca" onQueryChange={jest.fn()} />);
    expect(mockSearchNations).toHaveBeenLastCalledWith({ query: "ca" }, { enabled: true });
    expect(screen.getByText("Caphiria")).toBeTruthy();
  });
});

const DIRECTORY_REALM: DirectoryRealm = {
  id: "r1",
  slug: "ixnay",
  name: "Ixnay",
  description: null,
  thumbnail: null,
  bannerUrl: null,
  tags: [],
  foundedAt: new Date("2026-01-01T00:00:00Z"),
  nationCount: 10,
  openNationCount: 0,
  openNationPageCount: 0,
  myNationCount: 1,
  maxNationsPerUser: 3,
  board: { recentPosts: 0, lastPostAt: null },
  boardMessagesThisWeek: 0,
};

describe("YourRealms", () => {
  it("your realms lists nations with Play as", () => {
    render(
      <YourRealms
        realms={[
          {
            id: "r1",
            slug: "ixnay",
            name: "Ixnay",
            nations: [{ id: "c1", slug: "caphiria", name: "Caphiria", flag: null }],
          } as never,
        ]}
        directory={[DIRECTORY_REALM]}
        activeCountryId={null}
      />
    );
    expect(screen.getByRole("heading", { name: "Your realms" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Ixnay" }).getAttribute("href")).toBe("/r/ixnay");
    expect(screen.getByText("1 of 3")).toBeTruthy();
    const nations = screen.getByRole("list", { name: "Your nations in Ixnay" });
    expect(within(nations).getByText("Caphiria")).toBeTruthy();
    expect(within(nations).getByRole("button", { name: "Play as Caphiria" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Board" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Nations" }).getAttribute("href")).toBe(
      "/r/ixnay/nations"
    );
  });
});

describe("RealmFeed compact", () => {
  const posts = Array.from({ length: 7 }, (_, i) => ({
    id: `p${i + 1}`,
    content: `Post ${i + 1} ${"x".repeat(200)}`,
    timestamp: new Date(Date.now() - 3 * 3_600_000).toISOString(),
    account: { displayName: `Author ${i + 1}` },
  }));

  it("compact feed shows five rows and links to posts", () => {
    mockGetFeed.mockReturnValue({ data: { posts }, isLoading: false, error: null });
    render(<RealmFeed realmId="r1" realmSlug="ixnay" compact />);
    expect(screen.getAllByRole("listitem")).toHaveLength(5);
    expect(screen.queryByText("board block")).toBeNull();
    const first = screen.getAllByRole("link")[0]!;
    expect(first.getAttribute("href")).toBe("/dashboard/post/p1");
    expect(screen.getByText("Author 1")).toBeTruthy();
    expect(screen.getAllByText("3h ago")).toHaveLength(5);
    expect(first.textContent).not.toContain("x".repeat(121));
  });

  it("the default feed is unchanged", () => {
    mockGetFeed.mockReturnValue({ data: { posts }, isLoading: false, error: null });
    render(<RealmFeed realmId="r1" realmSlug="ixnay" />);
    expect(screen.getByText("board block")).toBeTruthy();
    expect(screen.getByText("full p7")).toBeTruthy();
  });
});
