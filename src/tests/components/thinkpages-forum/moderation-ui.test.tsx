import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

interface QueryResult {
  data?: object | null;
  isLoading?: boolean;
  error?: { data?: { code: string } } | null;
  refetch?: jest.Mock;
}

interface MockApi {
  results: Record<string, QueryResult>;
  mutations: Record<string, jest.Mock>;
  invalidations: Record<string, jest.Mock>;
}

jest.mock("~/trpc/react", () => {
  const results: Record<string, QueryResult> = {};
  const mutations: Record<string, jest.Mock> = {};
  const query = (name: string) => ({
    useQuery: () => ({ isLoading: false, error: null, ...results[name] }),
  });
  const mutation = (name: string) => ({
    useMutation: () => ({ mutateAsync: mutations[name], mutate: jest.fn(), isPending: false }),
  });
  const invalidations: Record<string, jest.Mock> = {};
  const invalidator = (name: string) => {
    invalidations[name] = jest.fn(() => Promise.resolve());
    return { invalidate: invalidations[name] };
  };
  const utils = {
    thinkpagesForum: {
      thread: invalidator("thread"),
      category: invalidator("category"),
      categories: invalidator("categories"),
      realmSection: invalidator("realmSection"),
      myStanding: invalidator("myStanding"),
      resolvePost: { fetch: () => Promise.resolve({ threadId: "t1", page: 1 }) },
    },
    thinkpagesForumMod: { context: invalidator("context") },
  };
  return {
    results,
    mutations,
    invalidations,
    api: {
      useUtils: () => utils,
      thinkpagesForum: {
        categories: query("categories"),
        realms: query("realms"),
        realmSection: query("realmSection"),
        category: query("category"),
        thread: query("thread"),
        myStanding: query("myStanding"),
        reply: mutation("reply"),
        editPost: mutation("editPost"),
        createThread: mutation("createThread"),
        report: mutation("report"),
        appeal: mutation("appeal"),
      },
      thinkpagesForumMod: {
        context: query("context"),
        setThreadFlag: mutation("setThreadFlag"),
        moveThread: mutation("moveThread"),
        setPostHidden: mutation("setPostHidden"),
        editPost: mutation("modEditPost"),
        warn: mutation("warn"),
        ban: mutation("ban"),
      },
      actionLinks: { activityCards: query("activityCards") },
    },
  };
});

jest.mock("next/navigation", () => {
  const router = { push: jest.fn(), replace: jest.fn() };
  return { router, useRouter: () => router, usePathname: () => "/thinkpages/forum/t/t1" };
});

jest.mock("~/hooks/usePageTitle", () => ({ usePageTitle: jest.fn() }));

jest.mock("~/context/auth-context", () => {
  const auth = { isSignedIn: false };
  return { auth, useUser: () => ({ user: null, isSignedIn: auth.isSignedIn }) };
});

jest.mock("~/hooks/useNotify", () => {
  const notify = { success: jest.fn(), error: jest.fn(), info: jest.fn() };
  return { notify, useNotify: () => notify };
});

interface ComposerStubProps {
  submitLabel?: string;
  onSubmit: (input: { html: string; personaId: string | null }) => Promise<void>;
}

// Submits fixed HTML and shows a refused submit, as the real composer does.
jest.mock("~/components/thinkpages-forum/ForumComposer", () => {
  const { useState } = jest.requireActual<typeof React>("react");
  return {
    ForumComposer: ({ submitLabel = "Post", onSubmit }: ComposerStubProps) => {
      const [error, setError] = useState<string | null>(null);
      return (
        <div data-testid="composer">
          <button
            type="button"
            onClick={() =>
              void onSubmit({ html: "<p>fixed</p>", personaId: null }).catch((e: Error) =>
                setError(e.message)
              )
            }
          >
            {submitLabel}
          </button>
          {error ? <p role="alert">{error}</p> : null}
        </div>
      );
    },
  };
});

interface SelectStubProps {
  value?: string;
  onValueChange?: (value: string) => void;
  disabled?: boolean;
  children: React.ReactNode;
}

// Radix Select does not render its options in jsdom; swap in a native <select>.
jest.mock("~/components/ui/select", () => {
  const { createContext, useContext } = jest.requireActual<typeof React>("react");
  const Ctx = createContext<Omit<SelectStubProps, "children"> & { label?: string }>({});
  return {
    Select: ({ value, onValueChange, disabled, children }: SelectStubProps) => (
      <Ctx.Provider value={{ value, onValueChange, disabled }}>{children}</Ctx.Provider>
    ),
    SelectTrigger: () => null,
    SelectValue: () => null,
    SelectContent: ({ children }: { children: React.ReactNode }) => {
      const { value, onValueChange, disabled } = useContext(Ctx);
      return (
        <select value={value} disabled={disabled} onChange={(e) => onValueChange?.(e.target.value)}>
          {children}
        </select>
      );
    },
    SelectItem: ({ value, children }: { value: string; children: React.ReactNode }) => (
      <option value={value}>{children}</option>
    ),
  };
});

// Radix DropdownMenu opens on pointer events jsdom does not model; render its items inline.
jest.mock("~/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => (
    <div role="menu">{children}</div>
  ),
  DropdownMenuItem: ({
    children,
    onSelect,
  }: {
    children: React.ReactNode;
    onSelect?: (event: Event) => void;
  }) => (
    <button type="button" role="menuitem" onClick={() => onSelect?.(new Event("select"))}>
      {children}
    </button>
  ),
  DropdownMenuSeparator: () => <hr />,
}));

import { BanDialog, banScopeOptions } from "~/components/thinkpages-forum/BanDialog";
import { BanNotice } from "~/components/thinkpages-forum/BanNotice";
import { CategoryList } from "~/components/thinkpages-forum/CategoryList";
import type { ModContext } from "~/components/thinkpages-forum/mod/ModRow";
import { NewThreadForm } from "~/components/thinkpages-forum/NewThreadForm";
import { StandingCard } from "~/components/thinkpages-forum/StandingCard";
import { ThreadList } from "~/components/thinkpages-forum/ThreadList";
import { ThreadView } from "~/components/thinkpages-forum/ThreadView";
import { WarnDialog } from "~/components/thinkpages-forum/WarnDialog";

const { results, mutations, invalidations } = jest.requireMock<MockApi>("~/trpc/react");
const { auth } = jest.requireMock<{ auth: { isSignedIn: boolean } }>("~/context/auth-context");
const { notify } = jest.requireMock<{ notify: { success: jest.Mock; error: jest.Mock } }>(
  "~/hooks/useNotify"
);

const XSS = '<img src=x onerror="alert(1)">';
const BAN = "You are banned from the forum until 12 Oct 2026: spam";
const authors = {
  users: { u1: { name: "Kir", handle: "kir" }, u2: { name: "Rhea", handle: "rhea" } },
  personas: {},
};
const NO_MOD: ModContext = { isSiteAdmin: false, realms: [], categories: [] };

interface ThreadOverrides {
  canModerate?: boolean;
  canReply?: boolean;
  banned?: boolean;
  notice?: string | null;
  hidden?: boolean;
  locked?: boolean;
  /** The viewer started the thread (default: they did, as the author of p1). */
  viewerIsAuthor?: boolean;
}

function threadData(o: ThreadOverrides = {}) {
  return {
    thread: {
      id: "t1",
      title: "A thread",
      authorUserId: "u1",
      locked: o.locked ?? false,
      pinned: false,
      hidden: false,
      archived: false,
    },
    category: { id: "c1", key: "general", name: "General", icAllowed: false, realm: null },
    posts: [
      {
        id: "p1",
        authorUserId: "u1",
        authorPersonaId: null,
        contentHtml: "<p>Mine</p>",
        editedAt: null,
        createdAt: new Date(),
        byViewer: true,
        isOwn: !o.locked,
      },
      {
        id: "p2",
        authorUserId: "u2",
        authorPersonaId: null,
        contentHtml: "<p>Theirs</p>",
        editedAt: null,
        createdAt: new Date(),
        byViewer: false,
        isOwn: false,
        ...(o.canModerate ? { hidden: o.hidden ?? false } : {}),
      },
    ],
    total: 2,
    canReply: o.canReply ?? true,
    notice: o.notice ?? null,
    banned: o.banned ?? false,
    canModerate: o.canModerate ?? false,
    viewerIsAuthor: o.viewerIsAuthor ?? true,
    ...(o.canModerate
      ? { moderatorTools: { categories: [{ key: "side", name: "Side", realm: null }] } }
      : {}),
    authors,
  };
}

function set(name: string, result: QueryResult) {
  results[name] = result;
}

/** The post card for `postId`. */
function post(container: HTMLElement, postId: string): HTMLElement {
  const el = container.querySelector<HTMLElement>(`#post-${postId}`);
  if (!el) throw new Error(`post ${postId} not rendered`);
  return el;
}

beforeEach(() => {
  jest.clearAllMocks();
  for (const key of Object.keys(results)) delete results[key];
  for (const key of Object.keys(mutations)) delete mutations[key];
  auth.isSignedIn = false;
  set("activityCards", { data: [] });
  set("context", { data: NO_MOD });
});

describe("reporting", () => {
  it("offers Report to a signed-in viewer on another member's post, never on their own", () => {
    auth.isSignedIn = true;
    set("thread", { data: threadData() });
    const { container } = render(<ThreadView threadId="t1" page={1} />);
    expect(within(post(container, "p2")).getByRole("button", { name: "Report" })).toBeTruthy();
    expect(within(post(container, "p1")).queryByRole("button", { name: "Report" })).toBeNull();
  });

  it("offers no Report on the viewer's own post where they may no longer edit it", () => {
    auth.isSignedIn = true;
    set("thread", { data: threadData({ locked: true, canReply: false }) });
    const { container } = render(<ThreadView threadId="t1" page={1} />);
    expect(within(post(container, "p1")).queryByRole("button", { name: "Report" })).toBeNull();
    expect(within(post(container, "p2")).getByRole("button", { name: "Report" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Report thread" })).toBeNull();
  });

  it("offers no Report to anonymous visitors", () => {
    set("thread", { data: threadData() });
    render(<ThreadView threadId="t1" page={1} />);
    expect(screen.queryByRole("button", { name: /Report/ })).toBeNull();
  });

  it("sends the reason the member typed, as typed, and confirms with a toast", async () => {
    auth.isSignedIn = true;
    const report = jest.fn(() => Promise.resolve({ id: "r1" }));
    mutations.report = report;
    set("thread", { data: threadData() });
    const { container } = render(<ThreadView threadId="t1" page={1} />);
    fireEvent.click(within(post(container, "p2")).getByRole("button", { name: "Report" }));
    const dialog = screen.getByRole("dialog", { name: "Report this post" });
    fireEvent.change(within(dialog).getByRole("textbox"), { target: { value: XSS } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Send report" }));
    await waitFor(() =>
      expect(report).toHaveBeenCalledWith({ targetType: "post", targetId: "p2", reason: XSS })
    );
    expect(notify.success).toHaveBeenCalledWith("Report sent");
  });

  it("shows a refused report inline", async () => {
    auth.isSignedIn = true;
    mutations.report = jest.fn(() => Promise.reject(new Error("You've already reported this.")));
    set("thread", { data: threadData() });
    const { container } = render(<ThreadView threadId="t1" page={1} />);
    fireEvent.click(within(post(container, "p2")).getByRole("button", { name: "Report" }));
    const dialog = screen.getByRole("dialog", { name: "Report this post" });
    fireEvent.change(within(dialog).getByRole("textbox"), { target: { value: "Spam link" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Send report" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "You've already reported this."
    );
  });

  it("reports a thread the member did not start and does not moderate", async () => {
    auth.isSignedIn = true;
    const report = jest.fn(() => Promise.resolve({ id: "r2" }));
    mutations.report = report;
    set("thread", { data: threadData({ viewerIsAuthor: false }) });
    render(<ThreadView threadId="t1" page={1} />);
    expect(screen.queryByRole("group", { name: "Moderate thread" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Report thread" }));
    const dialog = screen.getByRole("dialog", { name: "Report this thread" });
    fireEvent.change(within(dialog).getByRole("textbox"), { target: { value: "Off topic" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Send report" }));
    await waitFor(() =>
      expect(report).toHaveBeenCalledWith({
        targetType: "thread",
        targetId: "t1",
        reason: "Off topic",
      })
    );
  });
});

describe("moderator tools", () => {
  it("shows the post menu and thread bar only when canModerate", () => {
    auth.isSignedIn = true;
    set("thread", { data: threadData() });
    const { unmount } = render(<ThreadView threadId="t1" page={1} />);
    expect(screen.queryByRole("button", { name: "Moderate post" })).toBeNull();
    expect(screen.queryByRole("group", { name: "Moderate thread" })).toBeNull();
    unmount();

    set("thread", { data: threadData({ canModerate: true }) });
    render(<ThreadView threadId="t1" page={1} />);
    expect(screen.getAllByRole("button", { name: "Moderate post" })).toHaveLength(2);
    expect(screen.getByRole("group", { name: "Moderate thread" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Report thread" })).toBeNull();
  });

  it("hides a post after the confirmation", async () => {
    auth.isSignedIn = true;
    const setPostHidden = jest.fn(() => Promise.resolve());
    mutations.setPostHidden = setPostHidden;
    set("thread", { data: threadData({ canModerate: true }) });
    const { container } = render(<ThreadView threadId="t1" page={1} />);
    fireEvent.click(within(post(container, "p2")).getByRole("menuitem", { name: "Hide post" }));
    expect(setPostHidden).not.toHaveBeenCalled();
    const confirm = screen.getByRole("alertdialog", { name: "Hide this post?" });
    fireEvent.click(within(confirm).getByRole("button", { name: "Hide post" }));
    await waitFor(() => expect(setPostHidden).toHaveBeenCalledWith({ postId: "p2", hidden: true }));
  });

  it("offers Warn and Ban on other members' posts, never on the moderator's own", () => {
    auth.isSignedIn = true;
    set("thread", { data: threadData({ canModerate: true }) });
    const { container } = render(<ThreadView threadId="t1" page={1} />);
    const own = within(post(container, "p1"));
    expect(own.getByRole("menuitem", { name: "Hide post" })).toBeInTheDocument();
    expect(own.queryByRole("menuitem", { name: "Warn author" })).toBeNull();
    expect(own.queryByRole("menuitem", { name: "Ban author" })).toBeNull();
    const theirs = within(post(container, "p2"));
    expect(theirs.getByRole("menuitem", { name: "Warn author" })).toBeInTheDocument();
    expect(theirs.getByRole("menuitem", { name: "Ban author" })).toBeInTheDocument();
  });

  it("clears the hide note when the confirmation is cancelled", () => {
    auth.isSignedIn = true;
    set("thread", { data: threadData({ canModerate: true }) });
    const { container } = render(<ThreadView threadId="t1" page={1} />);
    const hide = () =>
      fireEvent.click(within(post(container, "p2")).getByRole("menuitem", { name: "Hide post" }));
    hide();
    let confirm = screen.getByRole("alertdialog", { name: "Hide this post?" });
    fireEvent.change(within(confirm).getByRole("textbox"), { target: { value: "Spam" } });
    fireEvent.click(within(confirm).getByRole("button", { name: "Cancel" }));
    hide();
    confirm = screen.getByRole("alertdialog", { name: "Hide this post?" });
    expect(within(confirm).getByRole("textbox")).toHaveValue("");
  });

  it("marks a hidden post with a Hidden badge and offers Unhide", () => {
    auth.isSignedIn = true;
    set("thread", { data: threadData({ canModerate: true, hidden: true }) });
    const { container } = render(<ThreadView threadId="t1" page={1} />);
    const hidden = post(container, "p2");
    expect(within(hidden).getByText("Hidden")).toBeInTheDocument();
    expect(within(hidden).getByRole("menuitem", { name: "Unhide post" })).toBeInTheDocument();
    expect(within(post(container, "p1")).queryByText("Hidden")).toBeNull();
  });

  it("edits a post as moderator only with a note for the log", async () => {
    auth.isSignedIn = true;
    const modEditPost = jest.fn(() => Promise.resolve());
    mutations.modEditPost = modEditPost;
    set("thread", { data: threadData({ canModerate: true }) });
    const { container } = render(<ThreadView threadId="t1" page={1} />);
    fireEvent.click(
      within(post(container, "p2")).getByRole("menuitem", { name: "Edit as moderator" })
    );
    const editor = screen.getByRole("region", { name: "Edit post as moderator" });
    fireEvent.click(within(editor).getByRole("button", { name: "Save" }));
    expect(await within(editor).findByRole("alert")).toHaveTextContent(
      "Add a note for the moderation log."
    );
    expect(modEditPost).not.toHaveBeenCalled();
    fireEvent.change(within(editor).getByRole("textbox", { name: "Note for the moderation log" }), {
      target: { value: "Removed a slur" },
    });
    fireEvent.click(within(editor).getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(modEditPost).toHaveBeenCalledWith({
        postId: "p2",
        html: "<p>fixed</p>",
        note: "Removed a slur",
      })
    );
  });

  it("locks the thread from the bar", async () => {
    auth.isSignedIn = true;
    const setThreadFlag = jest.fn(() => Promise.resolve());
    mutations.setThreadFlag = setThreadFlag;
    set("thread", { data: threadData({ canModerate: true }) });
    render(<ThreadView threadId="t1" page={1} />);
    const bar = screen.getByRole("group", { name: "Moderate thread" });
    fireEvent.click(within(bar).getByRole("button", { name: "Lock" }));
    await waitFor(() =>
      expect(setThreadFlag).toHaveBeenCalledWith({ threadId: "t1", flag: "locked", value: true })
    );
    // The thread, then every listing whose counts follow it.
    await waitFor(() => expect(invalidations.realmSection).toHaveBeenCalled());
    expect(invalidations.thread).toHaveBeenCalledWith({ threadId: "t1" });
    expect(invalidations.category).toHaveBeenCalled();
    expect(invalidations.categories).toHaveBeenCalled();
  });

  it("surfaces a refused moderator action as an error toast", async () => {
    auth.isSignedIn = true;
    mutations.setThreadFlag = jest.fn(() =>
      Promise.reject(new Error("Site admins' content is moderated by site admins."))
    );
    set("thread", { data: threadData({ canModerate: true }) });
    render(<ThreadView threadId="t1" page={1} />);
    fireEvent.click(screen.getByRole("button", { name: "Pin" }));
    await waitFor(() =>
      expect(notify.error).toHaveBeenCalledWith(
        "Could not pin the thread",
        "Site admins' content is moderated by site admins."
      )
    );
  });

  it("moves the thread to a category it picks, after confirming", async () => {
    auth.isSignedIn = true;
    const moveThread = jest.fn(() => Promise.resolve());
    mutations.moveThread = moveThread;
    set("thread", { data: threadData({ canModerate: true }) });
    render(<ThreadView threadId="t1" page={1} />);
    fireEvent.click(screen.getByRole("button", { name: "Move" }));
    const dialog = screen.getByRole("alertdialog", { name: "Move this thread" });
    fireEvent.change(within(dialog).getByRole("combobox"), { target: { value: "side" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Move thread" }));
    await waitFor(() =>
      expect(moveThread).toHaveBeenCalledWith({ threadId: "t1", to: { key: "side" } })
    );
  });

  it("opens Move on the refreshed list after a move", async () => {
    auth.isSignedIn = true;
    mutations.moveThread = jest.fn(() => Promise.resolve());
    set("thread", { data: threadData({ canModerate: true }) });
    const { rerender } = render(<ThreadView threadId="t1" page={1} />);
    fireEvent.click(screen.getByRole("button", { name: "Move" }));
    fireEvent.click(screen.getByRole("button", { name: "Move thread" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    // Now in Side: General (its old home) is the only destination left.
    const moved = {
      ...threadData({ canModerate: true }),
      moderatorTools: { categories: [{ key: "general", name: "General", realm: null }] },
    };
    set("thread", { data: moved });
    rerender(<ThreadView threadId="t1" page={1} />);
    fireEvent.click(screen.getByRole("button", { name: "Move" }));
    const dialog = screen.getByRole("alertdialog", { name: "Move this thread" });
    expect(within(dialog).getByRole("combobox")).toHaveValue("general");
    fireEvent.click(within(dialog).getByRole("button", { name: "Move thread" }));
    await waitFor(() =>
      expect(mutations.moveThread).toHaveBeenLastCalledWith({
        threadId: "t1",
        to: { key: "general" },
      })
    );
  });
});

describe("warnings", () => {
  function pointOptions(): string[] {
    const dialog = screen.getByRole("dialog", { name: "Warn this member" });
    return within(dialog)
      .getAllByRole("option")
      .map((o) => o.getAttribute("value") ?? "")
      .filter((v) => /^\d+$/.test(v));
  }

  it("caps points at 2 for a moderator and 5 for a site admin", () => {
    const target = { type: "post" as const, id: "p2" };
    const { unmount } = render(
      <WarnDialog userId="u2" target={target} open onOpenChange={jest.fn()} />
    );
    expect(pointOptions()).toEqual(["1", "2"]);
    expect(
      screen.getByText(
        "Points expire after 90 days. 5 active points mean a 7-day forum ban, 10 a 30-day ban."
      )
    ).toBeInTheDocument();
    unmount();

    set("context", { data: { ...NO_MOD, isSiteAdmin: true } });
    render(<WarnDialog userId="u2" target={target} open onOpenChange={jest.fn()} />);
    expect(pointOptions()).toEqual(["1", "2", "3", "4", "5"]);
  });

  it("issues the warning with the points and reason chosen", async () => {
    const warn = jest.fn(() => Promise.resolve({ activePoints: 2, autoBan: null }));
    mutations.warn = warn;
    const onOpenChange = jest.fn();
    render(
      <WarnDialog
        userId="u2"
        target={{ type: "post", id: "p2" }}
        open
        onOpenChange={onOpenChange}
      />
    );
    const dialog = screen.getByRole("dialog", { name: "Warn this member" });
    fireEvent.change(within(dialog).getByRole("combobox"), { target: { value: "2" } });
    fireEvent.change(within(dialog).getByRole("textbox"), { target: { value: "Flaming" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Warn" }));
    await waitFor(() =>
      expect(warn).toHaveBeenCalledWith({
        userId: "u2",
        points: 2,
        reason: "Flaming",
        target: { type: "post", id: "p2" },
      })
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});

describe("bans", () => {
  const hub = { key: "hub", name: "Hub", realm: { slug: "eurth", name: "Eurth" } };
  const eurthMod = { ...NO_MOD, realms: [{ id: "r1", slug: "eurth", name: "Eurth" }] };

  it("offers only the scopes the viewer may ban from", () => {
    const values = (context: typeof NO_MOD | undefined) =>
      banScopeOptions(hub, context).map((o) => [o.value, o.scope]);
    expect(values(NO_MOD)).toEqual([
      ["category", { kind: "category", key: "hub", realm: "eurth" }],
    ]);
    expect(values(undefined)).toEqual(values(NO_MOD));
    expect(values({ ...NO_MOD, realms: [{ id: "r2", slug: "other", name: "Other" }] })).toEqual(
      values(NO_MOD)
    );
    expect(values(eurthMod)).toEqual([
      ["category", { kind: "category", key: "hub", realm: "eurth" }],
      ["realm", { kind: "realm", realm: "eurth" }],
    ]);
    expect(values({ ...NO_MOD, isSiteAdmin: true }).map(([value]) => value)).toEqual([
      "category",
      "realm",
      "site",
    ]);
    const general = { key: "general", name: "General", realm: null };
    expect(banScopeOptions(general, { ...NO_MOD, isSiteAdmin: true }).map((o) => o.scope)).toEqual([
      { kind: "category", key: "general" },
      { kind: "site" },
    ]);
  });

  it("bans for a custom number of days, or permanently", async () => {
    const ban = jest.fn(() => Promise.resolve({ id: "b1", expiresAt: null }));
    mutations.ban = ban;
    const scopes = banScopeOptions(hub, eurthMod);
    const { unmount } = render(
      <BanDialog userId="u2" scopes={scopes} open onOpenChange={jest.fn()} />
    );
    let dialog = screen.getByRole("dialog", { name: "Ban this member" });
    const [scope, length] = within(dialog).getAllByRole("combobox");
    fireEvent.change(scope!, { target: { value: "realm" } });
    fireEvent.change(length!, { target: { value: "custom" } });
    const submit = within(dialog).getByRole("button", { name: "Ban" });
    fireEvent.change(within(dialog).getByRole("textbox", { name: "Reason" }), {
      target: { value: "Spam" },
    });
    fireEvent.change(within(dialog).getByRole("spinbutton", { name: "Days" }), {
      target: { value: "4000" },
    });
    expect(submit).toBeDisabled();
    fireEvent.change(within(dialog).getByRole("spinbutton", { name: "Days" }), {
      target: { value: "14" },
    });
    fireEvent.click(submit);
    await waitFor(() =>
      expect(ban).toHaveBeenCalledWith({
        userId: "u2",
        scope: { kind: "realm", realm: "eurth" },
        reason: "Spam",
        days: 14,
      })
    );
    unmount();

    render(<BanDialog userId="u2" scopes={scopes} open onOpenChange={jest.fn()} />);
    dialog = screen.getByRole("dialog", { name: "Ban this member" });
    fireEvent.change(within(dialog).getAllByRole("combobox")[1]!, {
      target: { value: "permanent" },
    });
    fireEvent.change(within(dialog).getByRole("textbox", { name: "Reason" }), {
      target: { value: "Ban evasion" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Ban" }));
    await waitFor(() =>
      expect(ban).toHaveBeenLastCalledWith(
        expect.objectContaining({
          scope: { kind: "category", key: "hub", realm: "eurth" },
          days: null,
        })
      )
    );
  });
});

describe("ban notices", () => {
  it("replaces the composer with the ban notice and an Appeal link", () => {
    auth.isSignedIn = true;
    set("thread", { data: threadData({ canReply: false, banned: true, notice: BAN }) });
    render(<ThreadView threadId="t1" page={1} />);
    expect(screen.queryByTestId("composer")).toBeNull();
    expect(screen.getByText(BAN)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Appeal" })).toHaveAttribute(
      "href",
      "/thinkpages/forum#standing"
    );
  });

  it("shows a plain notice, with a sign-in link, when the visitor is not banned", () => {
    const notice = "Sign in and claim a nation in Eurth to post here.";
    set("thread", { data: threadData({ canReply: false, notice }) });
    render(<ThreadView threadId="t1" page={1} />);
    expect(screen.queryByTestId("composer")).toBeNull();
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/sign-in?redirect_url=%2Fthinkpages%2Fforum%2Ft%2Ft1"
    );
    expect(screen.queryByRole("link", { name: "Appeal" })).toBeNull();
  });

  it("puts the ban notice under a category's header, else the plain line", () => {
    const category = { key: "general", name: "General", description: null, icAllowed: false };
    const base = { category, threads: [], total: 0, canStart: false, authors };
    set("category", { data: { ...base, notice: BAN, banned: true } });
    const { rerender } = render(<ThreadList categoryKey="general" page={1} />);
    expect(screen.getByText(BAN)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Appeal" })).toBeInTheDocument();

    const plain = "Only staff can start threads here.";
    set("category", { data: { ...base, notice: plain, banned: false } });
    rerender(<ThreadList categoryKey="general" page={1} />);
    expect(screen.getByText(plain)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Appeal" })).toBeNull();
  });

  it("renders a stored notice as text, never as markup", () => {
    const { container } = render(<BanNotice notice={`Banned: ${XSS}`} />);
    expect(screen.getByText(`Banned: ${XSS}`)).toBeInTheDocument();
    expect(container.querySelector("img")).toBeNull();
  });
});

describe("new thread", () => {
  it("says Could not load this page on a query error, not that the viewer may not post", () => {
    const refetch = jest.fn();
    set("category", {
      data: undefined,
      error: { data: { code: "INTERNAL_SERVER_ERROR" } },
      refetch,
    });
    render(<NewThreadForm categoryKey="general" />);
    expect(screen.getByText("Could not load this page")).toBeInTheDocument();
    expect(screen.queryByText("You can't start a thread here")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("shows the ban notice when a ban is why the viewer may not start one", () => {
    const category = { key: "general", name: "General", description: null, icAllowed: false };
    set("category", {
      data: {
        category,
        threads: [],
        total: 0,
        canStart: false,
        notice: BAN,
        banned: true,
        authors,
      },
    });
    render(<NewThreadForm categoryKey="general" />);
    expect(screen.getByText(BAN)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Appeal" })).toBeInTheDocument();
  });
});

describe("standing", () => {
  const standing = {
    activePoints: 2,
    warnings: [
      {
        id: "w1",
        points: 2,
        reason: XSS,
        createdAt: new Date("2026-10-01T00:00:00Z"),
        expiresAt: new Date("2026-12-30T00:00:00Z"),
        revokedAt: null,
        appeal: null,
        canAppeal: true,
      },
    ],
    bans: [],
    appeals: [],
  };

  it("lists a warning as text and appeals it", async () => {
    const appeal = jest.fn(() => Promise.resolve({ id: "a1" }));
    mutations.appeal = appeal;
    set("myStanding", { data: standing });
    const { container } = render(<StandingCard />);
    const card = container.querySelector("#standing");
    expect(card).not.toBeNull();
    expect(screen.getByRole("heading", { name: "Your standing" })).toBeInTheDocument();
    expect(screen.getByText(XSS)).toBeInTheDocument();
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText("2 points")).toBeInTheDocument();
    expect(screen.getByText("Expires 30 Dec 2026")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Appeal" }));
    const dialog = screen.getByRole("dialog", { name: "Appeal this warning" });
    const body = "I was quoting the other member, not flaming.";
    fireEvent.change(within(dialog).getByRole("textbox"), { target: { value: body } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Send appeal" }));
    await waitFor(() =>
      expect(appeal).toHaveBeenCalledWith({ subjectType: "warning", subjectId: "w1", body })
    );
  });

  it("renders nothing for a member in good standing", () => {
    set("myStanding", { data: { activePoints: 0, warnings: [], bans: [], appeals: [] } });
    const { container } = render(<StandingCard />);
    expect(container).toBeEmptyDOMElement();
  });

  it("puts the standing card and the Moderation link on the forum home", () => {
    auth.isSignedIn = true;
    set("categories", { data: [] });
    set("realms", { data: { defaultSlug: "ixworld", realms: [] } });
    set("realmSection", { isLoading: true });
    set("myStanding", { data: standing });
    set("context", { data: { ...NO_MOD, realms: [{ id: "r1", slug: "eurth", name: "Eurth" }] } });
    render(<CategoryList />);
    expect(screen.getByRole("heading", { name: "Your standing" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Moderation" })).toHaveAttribute(
      "href",
      "/thinkpages/mod"
    );
  });

  it("offers no Moderation link to members who moderate nothing", () => {
    auth.isSignedIn = true;
    set("categories", { data: [] });
    set("realms", { data: { defaultSlug: "ixworld", realms: [] } });
    set("realmSection", { isLoading: true });
    render(<CategoryList />);
    expect(screen.queryByRole("link", { name: "Moderation" })).toBeNull();
  });
});

describe("permalink scroll", () => {
  it("scrolls to the post in the hash once, not again when the posts refetch", () => {
    const scrollIntoView = jest.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    window.location.hash = "#post-p2";
    set("thread", { data: threadData() });
    const { rerender } = render(<ThreadView threadId="t1" page={1} />);
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    set("thread", { data: threadData() });
    rerender(<ThreadView threadId="t1" page={1} />);
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    window.location.hash = "";
  });
});

describe("warn dialog while the moderation context loads", () => {
  const target = { type: "post" as const, id: "p2" };

  function pointsSelect(): HTMLSelectElement {
    const dialog = screen.getByRole("dialog", { name: "Warn this member" });
    return within(dialog).getByRole("combobox") as HTMLSelectElement;
  }

  it("offers one point and keeps the select disabled until the context is known", () => {
    set("context", { isLoading: true, data: null });
    render(<WarnDialog userId="u2" target={target} open onOpenChange={jest.fn()} />);
    expect(pointsSelect()).toBeDisabled();
    expect(within(pointsSelect()).getAllByRole("option")).toHaveLength(1);
  });

  it("shows a site admin all five options once loaded, never the moderator's two", () => {
    set("context", { isLoading: true, data: null });
    const { rerender } = render(
      <WarnDialog userId="u2" target={target} open onOpenChange={jest.fn()} />
    );
    set("context", { data: { ...NO_MOD, isSiteAdmin: true } });
    rerender(<WarnDialog userId="u2" target={target} open onOpenChange={jest.fn()} />);
    expect(pointsSelect()).not.toBeDisabled();
    expect(within(pointsSelect()).getAllByRole("option")).toHaveLength(5);
  });
});
