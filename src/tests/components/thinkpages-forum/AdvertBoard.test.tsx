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
