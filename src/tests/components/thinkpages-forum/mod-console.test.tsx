import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

interface QueryResult {
  data?: object | null;
  isLoading?: boolean;
  error?: { message?: string; data?: { code?: string } } | null;
  refetch?: jest.Mock;
}

interface MockApi {
  results: Record<string, QueryResult>;
  inputs: Record<string, object | undefined>;
  mutations: Record<string, jest.Mock>;
  invalidated: string[];
  resolveMember: jest.Mock;
}

jest.mock("~/trpc/react", () => {
  const results: Record<string, QueryResult> = {};
  const inputs: Record<string, object | undefined> = {};
  const mutations: Record<string, jest.Mock> = {};
  const invalidated: string[] = [];
  const resolveMember = jest.fn();
  const query = (name: string) => ({
    useQuery: (input?: object) => {
      inputs[name] = input;
      return { isLoading: false, error: null, ...results[name] };
    },
  });
  const mutation = (name: string) => ({
    useMutation: () => ({ mutateAsync: mutations[name], mutate: jest.fn(), isPending: false }),
  });
  const invalidator = (name: string) => ({
    invalidate: () => {
      invalidated.push(name);
      return Promise.resolve();
    },
  });
  const lists = ["context", "reports", "warnings", "bans", "appeals", "log", "categoryModerators"];
  return {
    results,
    inputs,
    mutations,
    invalidated,
    resolveMember,
    api: {
      useUtils: () => ({
        thinkpagesForumMod: {
          // The console refreshes every mod list at once after a change.
          ...invalidator("all"),
          resolveMember: { fetch: resolveMember },
        },
      }),
      thinkpagesForumMod: {
        ...Object.fromEntries(lists.map((name) => [name, query(name)])),
        resolveReport: mutation("resolveReport"),
        setThreadFlag: mutation("setThreadFlag"),
        setPostHidden: mutation("setPostHidden"),
        warn: mutation("warn"),
        ban: mutation("ban"),
        revokeWarning: mutation("revokeWarning"),
        liftBan: mutation("liftBan"),
        reviewAppeal: mutation("reviewAppeal"),
        setCategoryModerator: mutation("setCategoryModerator"),
      },
    },
  };
});

jest.mock("next/navigation", () => {
  const router = { push: jest.fn(), replace: jest.fn() };
  return {
    router,
    useRouter: () => router,
    usePathname: () => "/thinkpages/mod",
    useSearchParams: () => new URLSearchParams(),
  };
});

jest.mock("~/hooks/useNotify", () => {
  const notify = { success: jest.fn(), error: jest.fn(), info: jest.fn() };
  return { notify, useNotify: () => notify };
});

interface SelectStubProps {
  value?: string;
  onValueChange?: (value: string) => void;
  children: React.ReactNode;
}

// Radix Select does not render its options in jsdom; swap in a native <select>, named by its trigger.
jest.mock("~/components/ui/select", () => {
  const { createContext, useContext, useRef } = jest.requireActual<typeof React>("react");
  type Ctx = Omit<SelectStubProps, "children"> & { name?: { label?: string } };
  const SelectCtx = createContext<Ctx>({});
  return {
    Select: ({ value, onValueChange, children }: SelectStubProps) => {
      const name = useRef<{ label?: string }>({}).current;
      return (
        <SelectCtx.Provider value={{ value, onValueChange, name }}>{children}</SelectCtx.Provider>
      );
    },
    // Renders before SelectContent, so the native select below can take its label.
    SelectTrigger: ({ "aria-label": label }: { "aria-label"?: string }) => {
      const { name } = useContext(SelectCtx);
      if (name) name.label = label;
      return null;
    },
    SelectValue: () => null,
    SelectContent: ({ children }: { children: React.ReactNode }) => {
      const { value, onValueChange, name } = useContext(SelectCtx);
      return (
        <select
          aria-label={name?.label}
          value={value}
          onChange={(e) => onValueChange?.(e.target.value)}
        >
          {children}
        </select>
      );
    },
    SelectItem: ({ value, children }: { value: string; children: React.ReactNode }) => (
      <option value={value}>{children}</option>
    ),
  };
});

import { ModConsole } from "~/components/thinkpages-forum/mod/ModConsole";

const { results, inputs, mutations, invalidated, resolveMember } =
  jest.requireMock<MockApi>("~/trpc/react");
const { router } = jest.requireMock<{ router: { replace: jest.Mock; push: jest.Mock } }>(
  "next/navigation"
);

const { notify } = jest.requireMock<{ notify: { success: jest.Mock; error: jest.Mock } }>(
  "~/hooks/useNotify"
);

const XSS = '<img src=x onerror="alert(1)">';
const NO_MOD = { isSiteAdmin: false, realms: [], categories: [] };
const CAPHIRIA = { id: "rc", slug: "caphiria", name: "Caphiria" };
const REALM_MOD = {
  isSiteAdmin: false,
  realms: [CAPHIRIA],
  categories: [
    { id: "c1", key: "hub", name: "Hub", realm: { slug: "caphiria", name: "Caphiria" } },
  ],
};
const ADMIN = {
  isSiteAdmin: true,
  realms: [CAPHIRIA],
  categories: [
    { id: "c0", key: "general", name: "General", realm: null },
    { id: "c1", key: "hub", name: "Hub", realm: { slug: "caphiria", name: "Caphiria" } },
  ],
};
const authors = {
  users: {
    u1: { name: "Kir", handle: "kir" },
    u2: { name: "Rhea", handle: "rhea" },
    me: { name: "Me", handle: "me" },
  },
};
const empty = { rows: [], total: 0, authors: { users: {} } };

function report(overrides: object = {}) {
  return {
    id: "r1",
    targetType: "post",
    targetId: "p9",
    threadId: "t1",
    threadTitle: "A thread",
    excerpt: "Buy cheap gold",
    targetAuthorId: "u2",
    targetImportedAuthorName: null,
    hidden: false,
    categoryId: "c1",
    category: { key: "hub", name: "Hub", realm: { slug: "caphiria", name: "Caphiria" } },
    ownTarget: false,
    moderable: true,
    sanctionable: true,
    reporterId: "u1",
    reason: "Spam link",
    status: "open",
    handledBy: null,
    handledAt: null,
    note: null,
    createdAt: new Date(),
    ...overrides,
  };
}

function set(name: string, result: QueryResult) {
  results[name] = result;
}

function renderConsole(props: { tab?: string; realm?: string; page?: number } = {}) {
  return render(<ModConsole page={1} {...props} />);
}

beforeEach(() => {
  jest.clearAllMocks();
  for (const key of Object.keys(results)) delete results[key];
  for (const key of Object.keys(mutations)) delete mutations[key];
  invalidated.length = 0;
  for (const name of ["reports", "warnings", "bans", "appeals", "log"]) set(name, { data: empty });
  set("categoryModerators", { data: { rows: [], authors: { users: {} } } });
});

describe("access", () => {
  it("asks a signed-out visitor to sign in, with a way back to the console", () => {
    set("context", { data: null, error: { data: { code: "UNAUTHORIZED" } } });
    renderConsole();
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/sign-in?redirect_url=%2Fthinkpages%2Fmod"
    );
    expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();
  });

  it("still offers Retry for any other load failure", () => {
    set("context", { data: null, error: { message: "boom" } });
    renderConsole();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Sign in" })).toBeNull();
  });

  it("tells a member who moderates nothing so, with a way back", () => {
    set("context", { data: NO_MOD });
    renderConsole();
    expect(screen.getByText("You don't moderate anything")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to the forum" })).toHaveAttribute(
      "href",
      "/thinkpages"
    );
    expect(screen.queryByRole("tab")).toBeNull();
  });

  it("gives a realm moderator five tabs, no Moderators tab, and their realm in the scope filter", () => {
    set("context", { data: REALM_MOD });
    renderConsole();
    const tabs = screen.getAllByRole("tab").map((t) => t.textContent);
    expect(tabs).toEqual(["Queue", "Warnings", "Bans", "Appeals", "Log"]);
    expect(screen.getByRole("link", { name: "ThinkPages" })).toHaveAttribute("href", "/thinkpages");
    const scope = screen.getByRole("combobox", { name: "Scope" });
    const options = within(scope)
      .getAllByRole("option")
      .map((o) => o.textContent);
    expect(options).toEqual(["Everything I moderate", "Caphiria"]);
    fireEvent.change(scope, { target: { value: "caphiria" } });
    expect(router.replace).toHaveBeenCalledWith("/thinkpages/mod?realm=caphiria");
  });

  it("renders inside the forum page shell: Moderation heading, scope filter in the header, panel as a data table", () => {
    set("context", { data: REALM_MOD });
    set("reports", { data: { rows: [report()], total: 1, authors } });
    const { container } = renderConsole();
    expect(screen.getByRole("heading", { level: 1, name: "Moderation" })).toBeInTheDocument();
    const header = container.querySelector<HTMLElement>('[data-slot="page-header"]')!;
    expect(within(header).getByRole("combobox", { name: "Scope" })).toBeInTheDocument();
    const table = screen.getByRole("table", { name: "Reports" });
    expect(container.querySelector('[data-content="data"]')).toContainElement(table);
    expect(within(table).getByRole("columnheader", { name: "Report" })).toBeInTheDocument();
    expect(within(table).getByRole("columnheader", { name: "When" })).toBeInTheDocument();
    const row = within(table).getAllByRole("row")[1]!;
    expect(within(row).getAllByRole("cell")).toHaveLength(2);
    expect(within(row).getByRole("link", { name: "Buy cheap gold" })).toBeInTheDocument();
  });

  it("applies ?realm= for a category moderator, and lists the realms of their categories", () => {
    const categoryMod = { isSiteAdmin: false, realms: [], categories: REALM_MOD.categories };
    set("context", { data: categoryMod });
    renderConsole({ realm: "caphiria" });
    expect(inputs.reports).toMatchObject({ status: "open", realm: "caphiria", page: 1 });
    const options = within(screen.getByRole("combobox", { name: "Scope" }))
      .getAllByRole("option")
      .map((o) => o.textContent);
    expect(options).toEqual(["Everything I moderate", "Caphiria"]);
  });

  it("still ignores a realm the viewer has no scope in", () => {
    set("context", { data: REALM_MOD });
    renderConsole({ realm: "elsewhere" });
    expect(inputs.reports).toMatchObject({ realm: undefined });
  });

  it("passes the scope filter to the open panel", () => {
    set("context", { data: REALM_MOD });
    renderConsole({ realm: "caphiria" });
    expect(inputs.reports).toMatchObject({ status: "open", realm: "caphiria", page: 1 });
  });

  it("opens the tab named in ?tab= and switches tabs through the URL", () => {
    set("context", { data: REALM_MOD });
    renderConsole({ tab: "bans" });
    expect(screen.getByRole("tab", { name: "Bans" })).toHaveAttribute("aria-selected", "true");
    expect(inputs.bans).toMatchObject({ active: true });
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Log" }), { button: 0 });
    expect(router.replace).toHaveBeenCalledWith("/thinkpages/mod?tab=log");
  });

  it("shows the Moderators tab to site admins", () => {
    set("context", { data: ADMIN });
    renderConsole();
    expect(screen.getByRole("tab", { name: "Moderators" })).toBeInTheDocument();
  });
});

describe("report queue", () => {
  it("links the excerpt to the post and names the place, reporter and reason", () => {
    set("context", { data: REALM_MOD });
    set("reports", { data: { rows: [report()], total: 1, authors } });
    renderConsole();
    expect(screen.getByRole("link", { name: "Buy cheap gold" })).toHaveAttribute(
      "href",
      "/thinkpages/post/p9"
    );
    expect(screen.getByText("Caphiria / Hub")).toBeInTheDocument();
    expect(screen.getByText("Reported by Kir")).toBeInTheDocument();
    expect(screen.getByText("Spam link")).toBeInTheDocument();
  });

  it("links a reported thread to the thread", () => {
    set("context", { data: REALM_MOD });
    set("reports", {
      data: { rows: [report({ targetType: "thread", targetId: "t1" })], total: 1, authors },
    });
    renderConsole();
    expect(screen.getByRole("link", { name: "Buy cheap gold" })).toHaveAttribute(
      "href",
      "/thinkpages/t/t1"
    );
  });

  it("resolves a report with Resolve, then refreshes the queue and the context", async () => {
    const resolve = jest.fn(() => Promise.resolve());
    mutations.resolveReport = resolve;
    set("context", { data: REALM_MOD });
    set("reports", { data: { rows: [report()], total: 1, authors } });
    renderConsole();
    fireEvent.click(screen.getByRole("button", { name: "Resolve the report on Rhea's post" }));
    const dialog = screen.getByRole("dialog", { name: "Resolve this report" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Resolve" }));
    await waitFor(() =>
      expect(resolve).toHaveBeenCalledWith({ reportId: "r1", outcome: "resolved" })
    );
    await waitFor(() => expect(notify.success).toHaveBeenCalledWith("Report resolved"));
    await waitFor(() => expect(invalidated).toEqual(["all"]));
  });

  it("shows a refused action inside its dialog", async () => {
    mutations.resolveReport = jest.fn(() => Promise.reject(new Error("Already handled.")));
    set("context", { data: REALM_MOD });
    set("reports", { data: { rows: [report()], total: 1, authors } });
    renderConsole();
    fireEvent.click(screen.getByRole("button", { name: "Dismiss the report on Rhea's post" }));
    const dialog = screen.getByRole("dialog", { name: "Dismiss this report" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Dismiss" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Already handled.");
  });

  it("hides the reported post after a confirmation", async () => {
    const hide = jest.fn(() => Promise.resolve());
    mutations.setPostHidden = hide;
    set("context", { data: REALM_MOD });
    set("reports", { data: { rows: [report()], total: 1, authors } });
    renderConsole();
    fireEvent.click(screen.getByRole("button", { name: "Hide Rhea's post" }));
    const dialog = screen.getByRole("dialog", { name: "Hide this post" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Hide post" }));
    await waitFor(() => expect(hide).toHaveBeenCalledWith({ postId: "p9", hidden: true }));
    await waitFor(() => expect(notify.success).toHaveBeenCalledWith("Post hidden"));
  });

  it("hides a reported thread through the thread flag", async () => {
    const flag = jest.fn(() => Promise.resolve());
    mutations.setThreadFlag = flag;
    set("context", { data: REALM_MOD });
    set("reports", {
      data: { rows: [report({ targetType: "thread", targetId: "t1" })], total: 1, authors },
    });
    renderConsole();
    fireEvent.click(screen.getByRole("button", { name: "Hide Rhea's thread" }));
    const dialog = screen.getByRole("dialog", { name: "Hide this thread" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Hide thread" }));
    await waitFor(() =>
      expect(flag).toHaveBeenCalledWith({ threadId: "t1", flag: "hidden", value: true })
    );
  });

  it("offers Unhide instead of Hide on a hidden post, through the same confirmation", async () => {
    const hide = jest.fn(() => Promise.resolve());
    mutations.setPostHidden = hide;
    set("context", { data: REALM_MOD });
    set("reports", { data: { rows: [report({ hidden: true })], total: 1, authors } });
    renderConsole();
    expect(screen.queryByRole("button", { name: "Hide Rhea's post" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Unhide Rhea's post" }));
    const dialog = screen.getByRole("dialog", { name: "Unhide this post" });
    expect(within(dialog).getByText("Members see it again.")).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Unhide post" }));
    await waitFor(() => expect(hide).toHaveBeenCalledWith({ postId: "p9", hidden: false }));
    await waitFor(() => expect(notify.success).toHaveBeenCalledWith("Post unhidden"));
  });

  it("unhides a hidden reported thread through the thread flag", async () => {
    const flag = jest.fn(() => Promise.resolve());
    mutations.setThreadFlag = flag;
    set("context", { data: REALM_MOD });
    set("reports", {
      data: {
        rows: [report({ targetType: "thread", targetId: "t1", hidden: true })],
        total: 1,
        authors,
      },
    });
    renderConsole();
    expect(screen.queryByRole("button", { name: "Hide Rhea's thread" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Unhide Rhea's thread" }));
    const dialog = screen.getByRole("dialog", { name: "Unhide this thread" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Unhide thread" }));
    await waitFor(() =>
      expect(flag).toHaveBeenCalledWith({ threadId: "t1", flag: "hidden", value: false })
    );
    await waitFor(() => expect(notify.success).toHaveBeenCalledWith("Thread unhidden"));
  });

  it("warns the reported post's author about that post, then refreshes", async () => {
    const warn = jest.fn(() => Promise.resolve({ activePoints: 1, autoBan: null }));
    mutations.warn = warn;
    set("context", { data: REALM_MOD });
    set("reports", { data: { rows: [report()], total: 1, authors } });
    renderConsole();
    fireEvent.click(screen.getByRole("button", { name: "Warn Rhea" }));
    const dialog = screen.getByRole("dialog", { name: "Warn this member" });
    fireEvent.change(within(dialog).getByRole("textbox"), { target: { value: "Spam" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Warn" }));
    await waitFor(() =>
      expect(warn).toHaveBeenCalledWith({
        userId: "u2",
        points: 1,
        reason: "Spam",
        target: { type: "post", id: "p9" },
      })
    );
    await waitFor(() => expect(invalidated).toEqual(["all"]));
  });

  it("bans the reported post's author from the report's category by default", async () => {
    const ban = jest.fn(() => Promise.resolve({ banId: "b1", expiresAt: null }));
    mutations.ban = ban;
    set("context", { data: REALM_MOD });
    set("reports", { data: { rows: [report()], total: 1, authors } });
    renderConsole();
    fireEvent.click(screen.getByRole("button", { name: "Ban Rhea" }));
    const dialog = screen.getByRole("dialog", { name: "Ban this member" });
    const scopes = within(within(dialog).getAllByRole("combobox")[0]!)
      .getAllByRole("option")
      .map((o) => o.textContent);
    expect(scopes).toEqual(["Hub", "Caphiria forum"]);
    fireEvent.change(within(dialog).getByRole("textbox"), { target: { value: "Spam" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Ban" }));
    await waitFor(() =>
      expect(ban).toHaveBeenCalledWith({
        userId: "u2",
        scope: { kind: "category", key: "hub", realm: "caphiria" },
        reason: "Spam",
        days: 7,
      })
    );
    await waitFor(() => expect(invalidated).toEqual(["all"]));
  });

  it("renders a stored HTML reason as text", () => {
    set("context", { data: REALM_MOD });
    set("reports", { data: { rows: [report({ reason: XSS, excerpt: XSS })], total: 1, authors } });
    const { container } = renderConsole();
    expect(screen.getAllByText(XSS).length).toBeGreaterThan(0);
    expect(container.querySelector("img")).toBeNull();
  });

  it("names no reporter the server withheld and offers no handling on the viewer's own content", () => {
    set("context", { data: ADMIN });
    set("reports", {
      data: { rows: [report({ ownTarget: true, reporterId: null })], total: 1, authors },
    });
    renderConsole();
    expect(screen.queryByText(/Reported by/)).toBeNull();
    expect(screen.queryByRole("button", { name: /^Resolve/ })).toBeNull();
    expect(screen.getByText("About your own content")).toBeInTheDocument();
  });

  it("offers a realm moderator nothing but Open on a report about a site admin's post", () => {
    set("context", { data: REALM_MOD });
    set("reports", {
      data: {
        rows: [report({ moderable: false, sanctionable: false })],
        total: 1,
        authors,
      },
    });
    renderConsole();
    expect(screen.getByRole("link", { name: "Open Rhea's post" })).toBeInTheDocument();
    for (const name of [/^Hide/, /^Warn/, /^Ban/, /^Resolve/, /^Dismiss/]) {
      expect(screen.queryByRole("button", { name })).toBeNull();
    }
  });

  it("offers Hide and handling but no Warn or Ban on a report about a fellow moderator", () => {
    set("context", { data: REALM_MOD });
    set("reports", { data: { rows: [report({ sanctionable: false })], total: 1, authors } });
    renderConsole();
    expect(screen.getByRole("button", { name: "Hide Rhea's post" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Resolve the report on Rhea's post" })
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Warn Rhea" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Ban Rhea" })).toBeNull();
  });

  it("offers Hide and handling but no Warn or Ban on imported content, named by its imported author", () => {
    set("context", { data: REALM_MOD });
    const imported = report({
      targetAuthorId: null,
      targetImportedAuthorName: "OldName",
      sanctionable: false,
    });
    set("reports", { data: { rows: [imported], total: 1, authors } });
    renderConsole();
    expect(screen.getByRole("button", { name: "Hide OldName's post" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Resolve the report on OldName's post" })
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Warn / })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Ban / })).toBeNull();
  });

  it("offers no Hide on a report whose content is gone, and still handles it", () => {
    set("context", { data: REALM_MOD });
    const gone = report({
      threadId: null,
      threadTitle: null,
      excerpt: null,
      targetAuthorId: null,
      targetImportedAuthorName: null,
      sanctionable: false,
    });
    set("reports", { data: { rows: [gone], total: 1, authors } });
    renderConsole();
    expect(screen.getByText("The reported content is gone")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^(Hide|Unhide) / })).toBeNull();
    expect(
      screen.getByRole("button", { name: "Resolve the report on this post" })
    ).toBeInTheDocument();
  });

  it("switches status with the segmented control", () => {
    set("context", { data: REALM_MOD });
    renderConsole();
    fireEvent.click(screen.getByRole("radio", { name: "Dismissed" }));
    expect(inputs.reports).toMatchObject({ status: "dismissed" });
  });
});

describe("bans", () => {
  const ban = {
    id: "b1",
    scope: "realm",
    scopeId: "rc",
    reason: "Flooding",
    expiresAt: null,
    auto: true,
    userId: "u2",
    issuedBy: "u1",
    liftedAt: null,
    liftedBy: null,
    createdAt: new Date(),
  };

  it("lists the ban and lifts it after a confirmation", async () => {
    const lift = jest.fn(() => Promise.resolve());
    mutations.liftBan = lift;
    set("context", { data: REALM_MOD });
    set("bans", { data: { rows: [ban], total: 1, authors } });
    renderConsole({ tab: "bans" });
    expect(screen.getByText("Caphiria forum")).toBeInTheDocument();
    expect(screen.getByText("Permanent")).toBeInTheDocument();
    expect(screen.getByText("Automatic")).toBeInTheDocument();
    expect(screen.getByText("Triggered by Kir")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Lift the ban on Rhea" }));
    const dialog = screen.getByRole("dialog", { name: "Lift this ban" });
    expect(lift).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole("button", { name: "Lift ban" }));
    await waitFor(() => expect(lift).toHaveBeenCalledWith({ banId: "b1" }));
    await waitFor(() => expect(notify.success).toHaveBeenCalledWith("Ban lifted"));
    await waitFor(() => expect(invalidated).toEqual(["all"]));
  });

  it("names a manual ban's issuer, and a re-tier as the system's (M2, M5)", () => {
    set("context", { data: REALM_MOD });
    set("bans", {
      data: {
        rows: [
          { ...ban, auto: false },
          { ...ban, id: "b2", issuedBy: "system" },
        ],
        total: 2,
        authors,
      },
    });
    renderConsole({ tab: "bans" });
    expect(screen.getByText("Issued by Kir")).toBeInTheDocument();
    expect(screen.getByText("Re-tiered when a site ban ended")).toBeInTheDocument();
  });

  it("shows a ban's appeal status, and nothing when it was not appealed", () => {
    set("context", { data: REALM_MOD });
    set("bans", {
      data: {
        rows: [
          { ...ban, appealStatus: "open" },
          { ...ban, id: "b2", userId: "u1", appealStatus: null },
        ],
        total: 2,
        authors,
      },
    });
    renderConsole({ tab: "bans" });
    expect(screen.getByText("Appeal open")).toBeInTheDocument();
    expect(screen.getAllByText(/^Appeal /)).toHaveLength(1);
  });

  it("finds a member by handle before opening the ban form", async () => {
    resolveMember.mockResolvedValue({ id: "u2", name: "rhea" });
    set("context", { data: REALM_MOD });
    renderConsole({ tab: "bans" });
    fireEvent.change(screen.getByRole("textbox", { name: "Member handle" }), {
      target: { value: "@rhea" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Ban a member" }));
    await waitFor(() => expect(resolveMember).toHaveBeenCalledWith({ handle: "@rhea" }));
    expect(await screen.findByRole("dialog", { name: "Ban this member" })).toBeInTheDocument();
  });

  it("says when no member has the handle", async () => {
    resolveMember.mockResolvedValue(null);
    set("context", { data: REALM_MOD });
    renderConsole({ tab: "bans" });
    fireEvent.change(screen.getByRole("textbox", { name: "Member handle" }), {
      target: { value: "nobody" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Ban a member" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("No member has that handle.");
  });
});

describe("paging", () => {
  it("keeps the tab and scope in page links", () => {
    set("context", { data: REALM_MOD });
    set("bans", { data: { rows: [], total: 30, authors: { users: {} } } });
    renderConsole({ tab: "bans", realm: "caphiria" });
    expect(screen.getAllByRole("link", { name: "Next" })[0]).toHaveAttribute(
      "href",
      "/thinkpages/mod?tab=bans&realm=caphiria&page=2"
    );
  });

  it("moves a page past the end to the last page", () => {
    set("context", { data: REALM_MOD });
    set("bans", { data: { rows: [], total: 30, authors: { users: {} } } });
    renderConsole({ tab: "bans", page: 5 });
    expect(router.replace).toHaveBeenCalledWith("/thinkpages/mod?tab=bans&page=2");
  });

  it("offers Retry when a list fails to load", () => {
    const refetch = jest.fn();
    set("context", { data: REALM_MOD });
    set("reports", { error: { message: "Server unavailable" }, refetch });
    renderConsole();
    expect(screen.getByText("Server unavailable")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(refetch).toHaveBeenCalled();
  });

  it("drops ?page= when a filter changes", () => {
    set("context", { data: REALM_MOD });
    renderConsole({ page: 3 });
    fireEvent.click(screen.getByRole("radio", { name: "Resolved" }));
    expect(router.replace).toHaveBeenCalledWith("/thinkpages/mod");
  });
});

describe("warnings", () => {
  const warning = {
    id: "w1",
    userId: "u2",
    issuedBy: "u1",
    reason: "Rude",
    points: 2,
    targetType: null,
    targetId: null,
    categoryId: "c1",
    expiresAt: new Date(Date.now() + 86_400_000),
    revokedAt: null,
    revokedBy: null,
    createdAt: new Date(),
  };

  it("lists active warnings and revokes one with a note", async () => {
    const revoke = jest.fn(() => Promise.resolve());
    mutations.revokeWarning = revoke;
    set("context", { data: REALM_MOD });
    set("warnings", { data: { rows: [warning], total: 1, authors } });
    renderConsole({ tab: "warnings" });
    expect(inputs.warnings).toMatchObject({ activeOnly: true });
    expect(screen.getByText("2 points")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Revoke the warning for Rhea" }));
    const dialog = screen.getByRole("dialog", { name: "Revoke this warning" });
    fireEvent.change(within(dialog).getByRole("textbox"), { target: { value: "Misread" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Revoke warning" }));
    await waitFor(() => expect(revoke).toHaveBeenCalledWith({ warningId: "w1", note: "Misread" }));
    await waitFor(() => expect(notify.success).toHaveBeenCalledWith("Warning revoked"));
  });

  it("shows a warning's appeal status", () => {
    set("context", { data: REALM_MOD });
    set("warnings", {
      data: { rows: [{ ...warning, appealStatus: "moot" }], total: 1, authors },
    });
    renderConsole({ tab: "warnings" });
    expect(screen.getByText("Appeal closed, it had already ended")).toBeInTheDocument();
  });

  it("offers the targetless warning form to site admins only", () => {
    set("context", { data: REALM_MOD });
    const { unmount } = renderConsole({ tab: "warnings" });
    expect(screen.queryByRole("button", { name: "Warn a member" })).toBeNull();
    unmount();
    set("context", { data: ADMIN });
    renderConsole({ tab: "warnings" });
    expect(screen.getByRole("button", { name: "Warn a member" })).toBeInTheDocument();
  });
});

describe("appeals", () => {
  const subject = {
    kind: "ban",
    reason: "Flooding",
    expiresAt: null,
    issuedBy: "me",
    active: true,
    scope: "realm",
    scopeId: "rc",
    auto: false,
  };
  const appeal = {
    id: "a1",
    subjectType: "ban",
    subjectId: "b1",
    userId: "u2",
    body: "I was quoting someone else.",
    status: "open",
    reviewedBy: null,
    reviewedAt: null,
    response: null,
    createdAt: new Date(),
    subject,
    canReview: false,
  };

  it("offers no decision when the server says the viewer may not review (they issued the ban)", () => {
    set("context", { data: REALM_MOD });
    set("appeals", { data: { rows: [appeal], total: 1, authors } });
    renderConsole({ tab: "appeals" });
    expect(screen.getByText("Another moderator must review this")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Uphold/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Overturn/ })).toBeNull();
  });

  it("sends the response with Overturn", async () => {
    const review = jest.fn(() => Promise.resolve());
    mutations.reviewAppeal = review;
    set("context", { data: REALM_MOD });
    set("appeals", {
      data: {
        rows: [{ ...appeal, canReview: true, subject: { ...subject, issuedBy: "u1" } }],
        total: 1,
        authors,
      },
    });
    renderConsole({ tab: "appeals" });
    fireEvent.click(screen.getByRole("button", { name: "Overturn the ban on Rhea" }));
    const dialog = screen.getByRole("dialog", { name: "Overturn the ban" });
    const send = within(dialog).getByRole("button", { name: "Overturn" });
    expect(send).toBeDisabled();
    fireEvent.change(within(dialog).getByRole("textbox"), { target: { value: "Fair point." } });
    fireEvent.click(send);
    await waitFor(() =>
      expect(review).toHaveBeenCalledWith({
        appealId: "a1",
        outcome: "overturned",
        response: "Fair point.",
      })
    );
    await waitFor(() => expect(notify.success).toHaveBeenCalledWith("Appeal overturned"));
    await waitFor(() => expect(invalidated).toEqual(["all"]));
  });

  it("sends the response with Uphold", async () => {
    const review = jest.fn(() => Promise.resolve());
    mutations.reviewAppeal = review;
    set("context", { data: REALM_MOD });
    set("appeals", {
      data: {
        rows: [{ ...appeal, canReview: true, subject: { ...subject, issuedBy: "u1" } }],
        total: 1,
        authors,
      },
    });
    renderConsole({ tab: "appeals" });
    fireEvent.click(screen.getByRole("button", { name: "Uphold the ban on Rhea" }));
    const dialog = screen.getByRole("dialog", { name: "Uphold the ban" });
    fireEvent.change(within(dialog).getByRole("textbox"), { target: { value: "It stands." } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Uphold" }));
    await waitFor(() =>
      expect(review).toHaveBeenCalledWith({
        appealId: "a1",
        outcome: "upheld",
        response: "It stands.",
      })
    );
  });

  it("offers only Close appeal when the ban has already ended", async () => {
    const review = jest.fn(() => Promise.resolve());
    mutations.reviewAppeal = review;
    set("context", { data: REALM_MOD });
    set("appeals", {
      data: {
        rows: [
          { ...appeal, canReview: true, subject: { ...subject, issuedBy: "u1", active: false } },
        ],
        total: 1,
        authors,
      },
    });
    renderConsole({ tab: "appeals" });
    expect(
      screen.getByText("This ban has already ended; reviewing will close the appeal as moot.")
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Uphold/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Overturn/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Close appeal from Rhea" }));
    await waitFor(() =>
      expect(review).toHaveBeenCalledWith({
        appealId: "a1",
        outcome: "upheld",
        response: "This ban had already ended, so the appeal was closed without a decision.",
      })
    );
    await waitFor(() => expect(invalidated).toEqual(["all"]));
  });

  it("words the ended notice for a warning", () => {
    set("context", { data: REALM_MOD });
    set("appeals", {
      data: {
        rows: [
          {
            ...appeal,
            subjectType: "warning",
            canReview: true,
            subject: {
              kind: "warning",
              reason: "Rude",
              points: 2,
              categoryId: "c1",
              expiresAt: null,
              issuedBy: "u1",
              active: false,
            },
          },
        ],
        total: 1,
        authors,
      },
    });
    renderConsole({ tab: "appeals" });
    expect(
      screen.getByText("This warning has already ended; reviewing will close the appeal as moot.")
    ).toBeInTheDocument();
  });

  it("keeps 'Another moderator must review this' ahead of the ended notice", () => {
    set("context", { data: REALM_MOD });
    set("appeals", {
      data: { rows: [{ ...appeal, subject: { ...subject, active: false } }], total: 1, authors },
    });
    renderConsole({ tab: "appeals" });
    expect(screen.getByText("Another moderator must review this")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Close appeal/ })).toBeNull();
  });

  it("shows a moot appeal as a read-only status", () => {
    set("context", { data: REALM_MOD });
    set("appeals", {
      data: { rows: [{ ...appeal, status: "moot", response: null }], total: 1, authors },
    });
    renderConsole({ tab: "appeals" });
    expect(screen.getByText("Closed, it had already ended")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Uphold/ })).toBeNull();
  });
});

describe("log", () => {
  it("describes a thread lock and links the thread", () => {
    set("context", { data: REALM_MOD });
    set("log", {
      data: {
        rows: [
          {
            id: "l1",
            actorId: "u1",
            action: "thread.lock",
            targetType: "thread",
            targetId: "t1",
            scope: "realm",
            scopeId: "rc",
            detail: { note: XSS, from: false, to: true },
            createdAt: new Date(),
          },
        ],
        total: 1,
        authors,
      },
    });
    const { container } = renderConsole({ tab: "log" });
    expect(screen.getByText("Locked thread")).toBeInTheDocument();
    expect(screen.getByText("Kir")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open thread" })).toHaveAttribute(
      "href",
      "/thinkpages/t/t1"
    );
    expect(screen.getByText(XSS)).toBeInTheDocument();
    expect(container.querySelector("img")).toBeNull();
  });
});

describe("log post links", () => {
  const entry = (overrides: object) => ({
    id: "l2",
    actorId: "u1",
    action: "post.hide",
    targetType: "post",
    targetId: "p9",
    scope: "realm",
    scopeId: "rc",
    detail: {},
    createdAt: new Date(),
    ...overrides,
  });

  it("links a post entry to the post's permalink, not its thread page", () => {
    set("context", { data: REALM_MOD });
    set("log", { data: { rows: [entry({ detail: { threadId: "t1" } })], total: 1, authors } });
    renderConsole({ tab: "log" });
    expect(screen.getByRole("link", { name: "Open post" })).toHaveAttribute(
      "href",
      "/thinkpages/post/p9"
    );
  });

  it("links a report on a post to the post's permalink", () => {
    set("context", { data: REALM_MOD });
    const detail = { targetType: "post", targetId: "p7" };
    set("log", {
      data: {
        rows: [entry({ action: "report.resolve", targetType: "report", targetId: "r1", detail })],
        total: 1,
        authors,
      },
    });
    renderConsole({ tab: "log" });
    expect(screen.getByRole("link", { name: "Open post" })).toHaveAttribute(
      "href",
      "/thinkpages/post/p7"
    );
  });
});

describe("moderators", () => {
  it("adds a category moderator by handle", async () => {
    const setModerator = jest.fn(() => Promise.resolve());
    mutations.setCategoryModerator = setModerator;
    resolveMember.mockResolvedValue({ id: "u1", name: "kir" });
    set("context", { data: ADMIN });
    renderConsole({ tab: "moderators" });
    expect(inputs.categoryModerators).toEqual({ key: "general" });
    fireEvent.change(screen.getByRole("textbox", { name: "Member handle" }), {
      target: { value: "kir" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    await waitFor(() => expect(resolveMember).toHaveBeenCalledWith({ handle: "kir" }));
    await waitFor(() =>
      expect(setModerator).toHaveBeenCalledWith({ key: "general", userId: "u1", grant: true })
    );
    await waitFor(() => expect(invalidated).toEqual(["all"]));
  });

  it("removes a moderator of a realm category", async () => {
    const setModerator = jest.fn(() => Promise.resolve());
    mutations.setCategoryModerator = setModerator;
    set("context", { data: ADMIN });
    set("categoryModerators", {
      data: {
        rows: [{ userId: "u2", name: "Rhea", grantedBy: "u1", createdAt: new Date() }],
        authors,
      },
    });
    renderConsole({ tab: "moderators" });
    fireEvent.change(screen.getByRole("combobox", { name: "Category" }), {
      target: { value: "c1" },
    });
    expect(inputs.categoryModerators).toEqual({ key: "hub", realm: "caphiria" });
    fireEvent.click(screen.getByRole("button", { name: "Remove Rhea as a moderator of Hub" }));
    expect(setModerator).not.toHaveBeenCalled();
    const dialog = screen.getByRole("dialog", { name: "Remove this moderator" });
    // The server takes no note for this change, so the dialog offers none.
    expect(within(dialog).queryByRole("textbox")).toBeNull();
    fireEvent.click(within(dialog).getByRole("button", { name: "Remove moderator" }));
    await waitFor(() =>
      expect(setModerator).toHaveBeenCalledWith({
        key: "hub",
        realm: "caphiria",
        userId: "u2",
        grant: false,
      })
    );
    await waitFor(() =>
      expect(notify.success).toHaveBeenCalledWith("Rhea no longer moderates Hub")
    );
    await waitFor(() => expect(invalidated).toEqual(["all"]));
  });

  it("keeps a refused removal inside the dialog", async () => {
    mutations.setCategoryModerator = jest.fn(() => Promise.reject(new Error("Not allowed.")));
    set("context", { data: ADMIN });
    set("categoryModerators", {
      data: {
        rows: [{ userId: "u2", name: "Rhea", grantedBy: "u1", createdAt: new Date() }],
        authors,
      },
    });
    renderConsole({ tab: "moderators" });
    fireEvent.click(screen.getByRole("button", { name: "Remove Rhea as a moderator of General" }));
    const dialog = screen.getByRole("dialog", { name: "Remove this moderator" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Remove moderator" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Not allowed.");
    expect(notify.success).not.toHaveBeenCalled();
  });
});
