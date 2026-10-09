import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";

interface QueryResult {
  data?: object | null;
  isLoading?: boolean;
  isPlaceholderData?: boolean;
  error?: { data?: { code: string } } | null;
  refetch?: jest.Mock;
}

interface MockApi {
  results: Record<string, QueryResult>;
  inputs: Record<string, object | undefined>;
  options: Record<string, { placeholderData?: object } | undefined>;
}

jest.mock("~/trpc/react", () => {
  const results: Record<string, QueryResult> = {};
  const inputs: Record<string, object | undefined> = {};
  const options: Record<string, object | undefined> = {};
  const query = (name: string) => ({
    useQuery: (input?: object, opts?: object) => {
      inputs[name] = input;
      options[name] = opts;
      return { isLoading: false, error: null, ...results[name] };
    },
  });
  return {
    results,
    inputs,
    options,
    api: { thinkpagesForum: { realms: query("realms"), realmSection: query("realmSection") } },
  };
});

jest.mock("next/navigation", () => {
  const router = { push: jest.fn(), replace: jest.fn() };
  const nav = { query: "" };
  return {
    router,
    nav,
    useRouter: () => router,
    usePathname: () => "/thinkpages",
    useSearchParams: () => new URLSearchParams(nav.query),
  };
});

interface SelectStubProps {
  value?: string;
  onValueChange?: (value: string) => void;
  children: React.ReactNode;
}

// Radix Select does not render its options in jsdom; swap in a native <select>.
jest.mock("~/components/ui/select", () => {
  const { createContext, useContext } = jest.requireActual<typeof React>("react");
  const Ctx = createContext<Omit<SelectStubProps, "children">>({});
  return {
    Select: ({ value, onValueChange, children }: SelectStubProps) => (
      <Ctx.Provider value={{ value, onValueChange }}>{children}</Ctx.Provider>
    ),
    SelectTrigger: ({ "aria-label": label }: { "aria-label"?: string }) => (
      <span data-testid="trigger" aria-label={label} />
    ),
    SelectValue: () => null,
    SelectContent: ({ children }: { children: React.ReactNode }) => {
      const { value, onValueChange } = useContext(Ctx);
      return (
        <select value={value} onChange={(e) => onValueChange?.(e.target.value)}>
          {children}
        </select>
      );
    },
    SelectItem: ({ value, children }: { value: string; children: React.ReactNode }) => (
      <option value={value}>{children}</option>
    ),
  };
});

import { RealmSection } from "~/components/thinkpages-forum/RealmSection";

const { results, inputs, options } = jest.requireMock<MockApi>("~/trpc/react");
const { router, nav } = jest.requireMock<{
  router: { push: jest.Mock; replace: jest.Mock };
  nav: { query: string };
}>("next/navigation");

const NO_NATION = "Only owners of a nation in Eurth can post here.";

const realms = {
  defaultSlug: "eurth",
  realms: [
    { id: "default", slug: "ixworld", name: "IxWorld" },
    { id: "r_eurth", slug: "eurth", name: "Eurth" },
    { id: "r_other", slug: "other", name: "Other" },
  ],
};

function section(canPost: boolean, notice: string | null, needsNation = notice === NO_NATION) {
  const row = (key: string, name: string, threadCount: number) => ({
    key,
    name,
    description: `${name} talk`,
    icAllowed: key !== "hub",
    postRole: "any",
    threadCount,
    lastPostAt: null,
  });
  return {
    realm: { id: "r_eurth", slug: "eurth", name: "Eurth", status: "active" },
    categories: [
      row("hub", "Hub", 2),
      row("character-threads", "Character Threads", 1),
      row("current-events", "Current Events", 0),
    ],
    canPost,
    notice,
    needsNation,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  for (const key of Object.keys(results)) delete results[key];
  results.realms = { data: realms };
});

describe("RealmSection", () => {
  it("renders the realm's name and its three categories linking under /thinkpages/r", () => {
    results.realmSection = { data: section(true, null) };
    render(<RealmSection realm="eurth" />);
    expect(screen.getByRole("heading", { level: 2, name: "Eurth" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Hub/ })).toHaveAttribute(
      "href",
      "/thinkpages/r/eurth/hub"
    );
    expect(screen.getByRole("link", { name: /Character Threads/ })).toHaveAttribute(
      "href",
      "/thinkpages/r/eurth/character-threads"
    );
    expect(screen.getByRole("link", { name: /Current Events/ })).toHaveAttribute(
      "href",
      "/thinkpages/r/eurth/current-events"
    );
    expect(screen.getByText("2 threads")).toBeInTheDocument();
    expect(inputs.realmSection).toEqual({ realm: "eurth" });
  });

  it("opens the viewer's default realm when none is given", () => {
    results.realmSection = { data: section(true, null) };
    render(<RealmSection />);
    expect(inputs.realmSection).toEqual({ realm: "eurth" });
  });

  it("says the viewer can post when they can", () => {
    results.realmSection = { data: section(true, null) };
    render(<RealmSection realm="eurth" />);
    expect(screen.getByText("You can post here")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Claim a nation" })).toBeNull();
  });

  it("shows the no-nation notice with a link to claim a nation in the realm", () => {
    results.realmSection = { data: section(false, NO_NATION) };
    render(<RealmSection realm="eurth" />);
    expect(screen.getByText(NO_NATION)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Claim a nation" })).toHaveAttribute(
      "href",
      "/r/eurth/nations"
    );
    expect(screen.queryByText("You can post here")).toBeNull();
  });

  it("offers the claim link on the server's flag, not by matching the notice text (U6)", () => {
    results.realmSection = { data: section(false, "Reworded: claim a nation first.", true) };
    const { unmount } = render(<RealmSection realm="eurth" />);
    expect(screen.getByRole("link", { name: "Claim a nation" })).toBeInTheDocument();
    unmount();
    results.realmSection = { data: section(false, NO_NATION, false) };
    render(<RealmSection realm="eurth" />);
    expect(screen.queryByRole("link", { name: "Claim a nation" })).toBeNull();
  });

  it("keeps the card and its switcher while another realm loads (U6)", () => {
    results.realmSection = { data: section(false, NO_NATION), isPlaceholderData: true };
    render(<RealmSection realm="other" switcher />);
    expect(options.realmSection?.placeholderData).toBeDefined();
    // The new realm's name, the old realm's rows dimmed and busy, no verdict that belongs to the old realm.
    expect(screen.getByRole("heading", { level: 2, name: "Other" })).toBeInTheDocument();
    expect(screen.getByRole("combobox")).toHaveValue("other");
    expect(screen.getByRole("link", { name: /Hub/ }).closest("[aria-busy]")).toHaveAttribute(
      "aria-busy",
      "true"
    );
    expect(screen.queryByText(NO_NATION)).toBeNull();
  });

  it("shows any other notice without the claim link", () => {
    const signIn = "Sign in and claim a nation in Eurth to post here.";
    results.realmSection = { data: section(false, signIn) };
    const { unmount } = render(<RealmSection realm="eurth" />);
    const signInLink = screen.getByRole("link", { name: "Sign in" });
    expect(signInLink).toHaveAttribute("href", "/sign-in?redirect_url=%2Fthinkpages");
    expect(signInLink.parentElement).toHaveTextContent(signIn);
    expect(screen.queryByRole("link", { name: "Claim a nation" })).toBeNull();
    unmount();

    // P3: signing in comes back to the same realm and page.
    nav.query = "realm=eurth&page=2";
    const again = render(<RealmSection realm="eurth" />);
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/sign-in?redirect_url=%2Fthinkpages%3Frealm%3Deurth%26page%3D2"
    );
    again.unmount();
    nav.query = "";

    const muted = "You are muted on this realm's board.";
    results.realmSection = { data: section(false, muted) };
    render(<RealmSection realm="eurth" />);
    expect(screen.getByText(muted)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Claim a nation" })).toBeNull();
  });

  it("shows a ban as the ban notice with its Appeal link, not as a plain line", () => {
    const ban = "You are banned from this realm's forum until 12 Oct 2026: spam";
    results.realmSection = { data: { ...section(false, ban), banned: true } };
    render(<RealmSection realm="eurth" />);
    expect(screen.getByText(ban)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Appeal" })).toHaveAttribute(
      "href",
      "/thinkpages#standing"
    );
    expect(screen.queryByRole("link", { name: "Claim a nation" })).toBeNull();
  });

  it("offers a switcher of the given realms that replaces the URL on change", () => {
    results.realmSection = { data: section(true, null) };
    render(<RealmSection realm="eurth" switcher />);
    expect(screen.getByLabelText("Realm")).toBeInTheDocument();
    const select = screen.getByRole("combobox");
    expect(
      within(select)
        .getAllByRole("option")
        .map((o) => o.textContent)
    ).toEqual(["IxWorld", "Eurth", "Other"]);
    expect(select).toHaveValue("eurth");
    fireEvent.change(select, { target: { value: "other" } });
    expect(router.replace).toHaveBeenCalledWith("/thinkpages?realm=other");
  });

  it("keeps an unlisted realm opened by URL selectable in the switcher", () => {
    results.realmSection = {
      data: {
        ...section(true, null),
        realm: { id: "r_draft", slug: "hidden", name: "Hidden Realm", status: "active" },
      },
    };
    render(<RealmSection realm="hidden" switcher />);
    const select = screen.getByRole("combobox");
    expect(
      within(select)
        .getAllByRole("option")
        .map((o) => o.textContent)
    ).toEqual(["Hidden Realm", "IxWorld", "Eurth", "Other"]);
    expect(select).toHaveValue("hidden");
  });

  it("has no switcher unless asked for", () => {
    results.realmSection = { data: section(true, null) };
    render(<RealmSection realm="eurth" />);
    expect(screen.queryByRole("combobox")).toBeNull();
  });

  it("says the realm is not available on NOT_FOUND, inside the section", () => {
    results.realmSection = { data: undefined, error: { data: { code: "NOT_FOUND" } } };
    render(<RealmSection realm="hidden" switcher />);
    expect(screen.getByText("This realm is not available.")).toBeInTheDocument();
    expect(screen.getByRole("combobox")).toBeInTheDocument();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("offers Retry for any other error", () => {
    const refetch = jest.fn();
    results.realmSection = {
      data: undefined,
      error: { data: { code: "INTERNAL_SERVER_ERROR" } },
      refetch,
    };
    render(<RealmSection realm="eurth" />);
    expect(screen.queryByText("This realm is not available.")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });
});
