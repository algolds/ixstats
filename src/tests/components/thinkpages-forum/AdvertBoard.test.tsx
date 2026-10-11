import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

const mockState: {
  realms?: Array<{
    slug: string;
    name: string;
    advertThreadId: string | null;
    hiddenByModerator: boolean;
  }>;
  loading: boolean;
  signedIn: boolean;
  loaded: boolean;
} = { loading: false, signedIn: true, loaded: true };
const mockCreate = jest.fn();
const mockPush = jest.fn();
const mockInvalidate = jest.fn(() => Promise.resolve());

jest.mock("~/trpc/react", () => ({
  api: {
    useUtils: () => ({
      thinkpagesForum: {
        category: { invalidate: mockInvalidate },
        categories: { invalidate: mockInvalidate },
        myAdvertRealms: { invalidate: mockInvalidate },
      },
    }),
    thinkpagesForum: {
      myAdvertRealms: {
        useQuery: () => ({
          data: mockState.realms ? { realms: mockState.realms } : undefined,
          isLoading: mockState.loading,
          error: null,
          refetch: jest.fn(),
        }),
      },
      createAdvert: { useMutation: () => ({ mutateAsync: mockCreate, isPending: false }) },
    },
  },
}));
jest.mock("~/context/auth-context", () => ({
  useUser: () => ({ user: null, isSignedIn: mockState.signedIn, isLoaded: mockState.loaded }),
}));
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn() }),
}));
jest.mock("~/components/thinkpages-forum/composer", () =>
  jest.requireActual("~/tests/helpers/forum-composer-stub").composerStub()
);
jest.mock("~/components/thinkpages-forum/shell", () => ({
  ForumPage: ({
    title,
    breadcrumbs,
    back,
    children,
  }: {
    title: string;
    breadcrumbs?: React.ReactNode;
    back?: { href: string; label: string };
    children?: React.ReactNode;
  }) => (
    <main>
      <h1>{title}</h1>
      {breadcrumbs ? <p data-testid="crumbs">{breadcrumbs}</p> : null}
      {back ? <a href={back.href}>{back.label}</a> : null}
      {children}
    </main>
  ),
}));
// Radix DropdownMenu opens on pointer events jsdom does not model; render its items inline.
jest.mock("~/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => (
    <div role="menu">{children}</div>
  ),
  DropdownMenuItem: ({
    children,
    disabled,
  }: {
    children: React.ReactNode;
    asChild?: boolean;
    disabled?: boolean;
  }) => (
    <div role="menuitem" aria-disabled={disabled ? true : undefined}>
      {children}
    </div>
  ),
}));
jest.mock("~/components/ui/avatar", () => ({
  Avatar: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  AvatarImage: ({ src }: { src: string }) => <img src={src} alt="" />,
  AvatarFallback: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
}));

import { AdvertBoardAction } from "~/components/thinkpages-forum/advert/AdvertBoardAction";
import { advertThreadIdOf } from "~/components/thinkpages-forum/advert/advert-error";
import { NewAdvertForm } from "~/components/thinkpages-forum/advert/NewAdvertForm";
import { ThreadTable } from "~/components/thinkpages-forum/board/ThreadTable";
import type { ForumAuthors } from "~/components/thinkpages-forum/AuthorName";

const EURTH = {
  slug: "eurth",
  name: "Eurth",
  advertThreadId: null as string | null,
  hiddenByModerator: false,
};
const ZETA = {
  slug: "zeta",
  name: "Zeta",
  advertThreadId: null as string | null,
  hiddenByModerator: false,
};
const HIDDEN = { ...EURTH, hiddenByModerator: true };

beforeEach(() => {
  jest.clearAllMocks();
  mockState.realms = undefined;
  mockState.loading = false;
  mockState.signedIn = true;
  mockState.loaded = true;
});

describe("advert rows on the board", () => {
  const authors = {
    users: { u1: { name: "Kir", handle: "kir", avatarUrl: "/kir.png", flagUrl: null } },
    personas: {},
  } as ForumAuthors;
  const row = (advert: object | null | undefined) => ({
    id: "t1",
    title: "Join Eurth",
    authorUserId: "u1",
    authorPersonaId: null,
    importedAuthorName: null,
    xenforoThreadId: null,
    pinned: false,
    locked: false,
    hidden: false,
    postCount: 3,
    lastPostAt: new Date(),
    advert,
  });
  const renderRow = (advert: object | null | undefined) =>
    render(
      <ThreadTable
        threads={[row(advert)] as never}
        authors={authors}
        basePath="/thinkpages/c/find-a-realm"
        sort="latest"
      />
    );
  const advert = (over: object = {}) => ({
    realmSlug: "eurth",
    realmName: "Eurth",
    emblemUrl: "https://img.example/emblem.png",
    thumbnail: "https://img.example/thumb.png",
    claimsOpen: true,
    ...over,
  });
  const sources = (container: HTMLElement) =>
    [...container.querySelectorAll("img")].map((img) => img.getAttribute("src"));

  it("shows the realm's emblem in place of the author's avatar, with an Open to join pill", () => {
    const { container } = renderRow(advert());
    expect(sources(container)).toEqual(["https://img.example/emblem.png"]);
    expect(screen.getByText("Open to join")).toBeInTheDocument();
    expect(screen.getByText("Kir")).toBeInTheDocument();
  });

  it("falls back to the thumbnail, then to the realm mark", () => {
    const thumb = renderRow(advert({ emblemUrl: null }));
    expect(sources(thumb.container)).toEqual(["https://img.example/thumb.png"]);
    thumb.unmount();
    const mark = renderRow(advert({ emblemUrl: null, thumbnail: null }));
    expect(sources(mark.container)).toEqual([]);
  });

  it("falls back to the thumbnail when the emblem is an empty string", () => {
    const { container } = renderRow(advert({ emblemUrl: "" }));
    expect(sources(container)).toEqual(["https://img.example/thumb.png"]);
  });

  it("draws the realm mark (a globe, no picture) when there is no emblem or thumbnail", () => {
    const { container } = renderRow(advert({ emblemUrl: null, thumbnail: null }));
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("svg.size-5")).not.toBeNull();
  });

  it("names a persona's last post by the persona on an advert row, never the player", () => {
    const personaAuthors = {
      users: {
        u1: { name: "Kir", handle: "kir", avatarUrl: "/kir.png", flagUrl: "/flags/kir.png" },
      },
      personas: { pa: { displayName: "Aria Vance", username: "aria", avatarUrl: "/aria.png" } },
    } as ForumAuthors;
    render(
      <ThreadTable
        threads={
          [
            {
              ...row(advert()),
              lastPoster: { authorUserId: "u1", authorPersonaId: "pa", importedAuthorName: null },
            },
          ] as never
        }
        authors={personaAuthors}
        basePath="/thinkpages/c/find-a-realm"
        sort="latest"
      />
    );
    expect(screen.getByText("Aria Vance")).toBeInTheDocument();
    expect(document.querySelector('img[src="/aria.png"]')).not.toBeNull();
    expect(document.querySelectorAll('img[src^="/flags/"]')).toHaveLength(1);
  });

  it("leaves the pill out when the realm is closed to new nations", () => {
    renderRow(advert({ claimsOpen: false }));
    expect(screen.queryByText("Open to join")).toBeNull();
  });

  it("keeps the author's avatar and no pill on an ordinary thread, with or without the field", () => {
    for (const value of [null, undefined]) {
      const { container, unmount } = renderRow(value);
      expect(sources(container)).toEqual(["/kir.png"]);
      expect(screen.queryByText("Open to join")).toBeNull();
      unmount();
    }
  });
});

describe("AdvertBoardAction", () => {
  it("shows nothing to a signed-out viewer or to someone with the power in no realm", () => {
    mockState.signedIn = false;
    mockState.realms = [EURTH];
    const out = render(<AdvertBoardAction />);
    expect(out.container).toBeEmptyDOMElement();
    out.unmount();
    mockState.signedIn = true;
    mockState.realms = [];
    expect(render(<AdvertBoardAction />).container).toBeEmptyDOMElement();
  });

  it("offers Advertise your realm as one button for a viewer with one realm", () => {
    mockState.realms = [EURTH];
    render(<AdvertBoardAction />);
    expect(screen.getByRole("link", { name: "Advertise your realm" })).toHaveAttribute(
      "href",
      "/thinkpages/c/find-a-realm/new?advert=eurth"
    );
  });

  it("offers Edit your advert, linking the thread, once the realm has an advert", () => {
    mockState.realms = [{ ...EURTH, advertThreadId: "t_ad" }];
    render(<AdvertBoardAction />);
    expect(screen.getByRole("link", { name: "Edit your advert" })).toHaveAttribute(
      "href",
      "/thinkpages/t/t_ad"
    );
  });

  it("offers a realm picker for a viewer with several realms, per realm Advertise or Edit", () => {
    mockState.realms = [{ ...EURTH, advertThreadId: "t_ad" }, ZETA];
    render(<AdvertBoardAction />);
    expect(screen.getByRole("button", { name: "Advertise your realm" })).toBeInTheDocument();
    const menu = within(screen.getByRole("menu"));
    expect(menu.getByRole("link", { name: "Edit the Eurth advert" })).toHaveAttribute(
      "href",
      "/thinkpages/t/t_ad"
    );
    expect(menu.getByRole("link", { name: "Advertise Zeta" })).toHaveAttribute(
      "href",
      "/thinkpages/c/find-a-realm/new?advert=zeta"
    );
  });

  it("says a moderator hid the advert, with no link and no way to create another", () => {
    mockState.realms = [HIDDEN];
    render(<AdvertBoardAction />);
    expect(screen.getByText("Your advert was hidden by a moderator")).toBeInTheDocument();
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("words it for several when every one of a viewer's realms has a hidden advert", () => {
    mockState.realms = [HIDDEN, { ...ZETA, hiddenByModerator: true }];
    render(<AdvertBoardAction />);
    expect(screen.getByText("Your realms' adverts were hidden by a moderator")).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("lists a hidden advert in the menu without a link, beside the realms that can still act", () => {
    mockState.realms = [HIDDEN, ZETA];
    render(<AdvertBoardAction />);
    expect(screen.getByRole("button", { name: "Advertise your realm" })).toBeInTheDocument();
    const menu = within(screen.getByRole("menu"));
    expect(menu.getByText("The Eurth advert was hidden by a moderator")).toBeInTheDocument();
    expect(
      menu.getByText("The Eurth advert was hidden by a moderator").closest("[role=menuitem]")
    ).toHaveAttribute("aria-disabled", "true");
    expect(
      menu.getByRole("link", { name: "Advertise Zeta" }).closest("[role=menuitem]")
    ).not.toHaveAttribute("aria-disabled");
    expect(menu.queryByRole("link", { name: /Eurth/ })).toBeNull();
    expect(menu.getByRole("link", { name: "Advertise Zeta" })).toBeInTheDocument();
  });

  it("says Edit your advert on the trigger when every realm already has one", () => {
    mockState.realms = [
      { ...EURTH, advertThreadId: "t_a" },
      { ...ZETA, advertThreadId: "t_b" },
    ];
    render(<AdvertBoardAction />);
    expect(screen.getByRole("button", { name: "Edit your advert" })).toBeInTheDocument();
  });
});

describe("advertThreadIdOf", () => {
  it("reads the existing advert's thread id from a CONFLICT", () => {
    const error = Object.assign(new Error("This realm already has an advert."), {
      data: { code: "CONFLICT", context: { threadId: "t_old" } },
    });
    expect(advertThreadIdOf(error)).toBe("t_old");
  });

  it("is null for any other error", () => {
    expect(advertThreadIdOf(new Error("boom"))).toBeNull();
    expect(advertThreadIdOf(Object.assign(new Error("x"), { data: { context: {} } }))).toBeNull();
    expect(
      advertThreadIdOf(Object.assign(new Error("x"), { data: { context: { threadId: "" } } }))
    ).toBeNull();
  });
});

describe("NewAdvertForm", () => {
  it("asks a signed-out viewer to sign in", () => {
    mockState.signedIn = false;
    render(<NewAdvertForm />);
    expect(screen.getByText("Sign in to advertise your realm")).toBeInTheDocument();
  });

  it("shows a skeleton, not the sign-in ask, until the session has loaded", () => {
    mockState.loaded = false;
    mockState.signedIn = false;
    const { container } = render(<NewAdvertForm />);
    expect(container.querySelector("[aria-busy='true']")).not.toBeNull();
    expect(screen.queryByText("Sign in to advertise your realm")).toBeNull();
  });

  it("shows a skeleton while the realms load", () => {
    mockState.loading = true;
    const { container } = render(<NewAdvertForm />);
    expect(container.querySelector("[aria-busy='true']")).not.toBeNull();
  });

  it("explains that only a realm's founder and officers can advertise when the viewer has no realm", () => {
    mockState.realms = [];
    render(<NewAdvertForm />);
    expect(screen.getByText("You can't advertise a realm")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Post" })).toBeNull();
  });

  it("opens the composer for the only realm, and posts the advert to it", async () => {
    mockState.realms = [EURTH];
    mockCreate.mockResolvedValue({ threadId: "t_new", postId: "p_new", formatting: "done" });
    render(<NewAdvertForm />);
    expect(screen.getByTestId("crumbs")).toHaveTextContent("Eurth");
    fireEvent.click(screen.getByRole("button", { name: "Post" }));
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/thinkpages/t/t_new"));
    expect(mockCreate).toHaveBeenCalledWith({
      realm: "eurth",
      title: "Hello",
      wikitext: "New ''text''",
    });
    expect(mockInvalidate).toHaveBeenCalled();
  });

  it("stays on the page, with a way in, while the first post is still being formatted", async () => {
    mockState.realms = [EURTH];
    mockCreate.mockResolvedValue({ threadId: "t_new", postId: "p_new", formatting: "pending" });
    render(<NewAdvertForm realm="eurth" />);
    fireEvent.click(screen.getByRole("button", { name: "Post" }));
    expect(await screen.findByRole("link", { name: "Open the advert" })).toHaveAttribute(
      "href",
      "/thinkpages/t/t_new"
    );
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("keeps the post open, and shows the reward, when the advert earned one", async () => {
    mockState.realms = [EURTH];
    mockCreate.mockResolvedValue({
      threadId: "t_new",
      postId: "p_new",
      formatting: "done",
      reward: { amount: 25 },
    });
    render(<NewAdvertForm realm="eurth" />);
    fireEvent.click(screen.getByRole("button", { name: "Post" }));
    expect(await screen.findByTestId("stub-reward")).toHaveTextContent("25");
    expect(screen.getByRole("link", { name: "Open the advert" })).toHaveAttribute(
      "href",
      "/thinkpages/t/t_new"
    );
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("offers no composer for a realm whose advert a moderator hid", () => {
    mockState.realms = [HIDDEN];
    render(<NewAdvertForm realm="eurth" />);
    expect(screen.getByText("The Eurth advert is hidden")).toBeInTheDocument();
    expect(screen.getByText("Your realm's advert was hidden by a moderator.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Post" })).toBeNull();
  });

  it("shows the hidden-advert refusal in the composer when it is the server's answer, and refreshes the realms", async () => {
    mockState.realms = [EURTH];
    mockCreate.mockRejectedValue(
      Object.assign(new Error("Your realm's advert was hidden by a moderator."), {
        data: { code: "CONFLICT" },
      })
    );
    render(<NewAdvertForm realm="eurth" />);
    fireEvent.click(screen.getByRole("button", { name: "Post" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("hidden by a moderator");
    expect(screen.getByRole("button", { name: "Post" })).toBeInTheDocument();
    expect(mockInvalidate).toHaveBeenCalled();
  });

  it("shows the existing advert instead of a composer when the realm has one", () => {
    mockState.realms = [{ ...EURTH, advertThreadId: "t_old" }];
    render(<NewAdvertForm realm="eurth" />);
    expect(screen.getByText("Eurth already has an advert")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Edit your advert" })).toHaveAttribute(
      "href",
      "/thinkpages/t/t_old"
    );
    expect(screen.queryByRole("button", { name: "Post" })).toBeNull();
  });

  it("lets a viewer with several realms pick one, and says so when the named realm is not theirs", () => {
    mockState.realms = [{ ...EURTH, advertThreadId: "t_old" }, ZETA];
    const picker = render(<NewAdvertForm />);
    expect(screen.getByText("Choose a realm")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Advertise Zeta/ })).toHaveAttribute(
      "href",
      "/thinkpages/c/find-a-realm/new?advert=zeta"
    );
    expect(screen.getByRole("link", { name: /Edit the Eurth advert/ })).toHaveAttribute(
      "href",
      "/thinkpages/t/t_old"
    );
    picker.unmount();
    render(<NewAdvertForm realm="elsewhere" />);
    expect(screen.getByText(/can't advertise that realm/i)).toBeInTheDocument();
  });

  it("does not refresh the realms for a refusal that is not a conflict", async () => {
    mockState.realms = [EURTH];
    mockCreate.mockRejectedValue(new Error("boom"));
    render(<NewAdvertForm realm="eurth" />);
    fireEvent.click(screen.getByRole("button", { name: "Post" }));
    await screen.findByRole("alert");
    expect(mockInvalidate).not.toHaveBeenCalled();
  });

  it("lists a realm whose advert a moderator hid in the picker, with no link", () => {
    mockState.realms = [HIDDEN, ZETA];
    render(<NewAdvertForm />);
    expect(screen.getByText("Advert hidden by a moderator")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Eurth/ })).toBeNull();
    expect(screen.getByRole("link", { name: /Advertise Zeta/ })).toBeInTheDocument();
  });

  it("switches to the existing advert when another tab created it first", async () => {
    mockState.realms = [EURTH];
    mockCreate.mockRejectedValue(
      Object.assign(new Error("This realm already has an advert."), {
        data: { code: "CONFLICT", context: { threadId: "t_race" } },
      })
    );
    render(<NewAdvertForm realm="eurth" />);
    fireEvent.click(screen.getByRole("button", { name: "Post" }));
    expect(await screen.findByText("Eurth already has an advert")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Edit your advert" })).toHaveAttribute(
      "href",
      "/thinkpages/t/t_race"
    );
    expect(mockPush).not.toHaveBeenCalled();
    expect(mockInvalidate).toHaveBeenCalled();
  });

  it("shows another refusal in the composer and keeps the form", async () => {
    mockState.realms = [EURTH];
    mockCreate.mockRejectedValue(new Error("An archived realm cannot be advertised."));
    render(<NewAdvertForm realm="eurth" />);
    fireEvent.click(screen.getByRole("button", { name: "Post" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "An archived realm cannot be advertised."
    );
    expect(screen.getByRole("button", { name: "Post" })).toBeInTheDocument();
  });
});
