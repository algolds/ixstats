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
  resolvePost: jest.Mock;
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
  const resolvePost = jest.fn(() => Promise.resolve({ threadId: "t1", page: 1 }));
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
      isThreadStashed: invalidator("isThreadStashed"),
      navCounts: invalidator("navCounts"),
      resolvePost: { fetch: resolvePost },
    },
    thinkpagesForumMod: { ...invalidator("mod"), context: invalidator("context") },
  };
  return {
    resolvePost,
    results,
    mutations,
    invalidations,
    api: {
      wikios: { getMissingPages: { useQuery: () => ({ data: undefined }) } },
      useUtils: () => utils,
      thinkpagesForum: {
        categories: query("categories"),
        realms: query("realms"),
        realmSection: query("realmSection"),
        category: query("category"),
        thread: query("thread"),
        myStanding: query("myStanding"),
        isThreadStashed: query("isThreadStashed"),
        markThreadRead: mutation("markThreadRead"),
        markCategoryRead: mutation("markCategoryRead"),
        watchThread: mutation("watchThread"),
        unwatchThread: mutation("unwatchThread"),
        stashThread: mutation("stashThread"),
        unstashThread: mutation("unstashThread"),
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
      // useThreadActionCards batches through useQueries; no post here holds a token.
      useQueries: (_queries: unknown, opts: { combine: (results: never[]) => unknown }) =>
        opts.combine([]),
    },
  };
});

jest.mock("next/navigation", () => {
  const router = { push: jest.fn(), replace: jest.fn() };
  return {
    router,
    useRouter: () => router,
    usePathname: () => "/thinkpages/t/t1",
    useSearchParams: () => new URLSearchParams(),
  };
});

jest.mock("~/components/thinkpages-forum/reactions", () => ({ ReactionBar: () => null }));
jest.mock("~/components/action-links/DiscussionCountsProvider", () => ({
  DiscussionCountsProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useDiscussionCount: () => undefined,
}));
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
jest.mock("~/components/thinkpages-forum/composer", () =>
  jest.requireActual("~/tests/helpers/forum-composer-stub").composerStub()
);
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
  DropdownMenuRadioGroup: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuRadioItem: ({ children }: { children: React.ReactNode }) => (
    <button type="button" role="menuitemradio">
      {children}
    </button>
  ),
}));
import { BanNotice } from "~/components/thinkpages-forum/BanNotice";
import type { ModContext } from "~/components/thinkpages-forum/mod/ModRow";
import { StandingPanel } from "~/components/thinkpages-forum/StandingPanel";
// A board's rail sits in the Inspector, which asks the viewport: narrow, so its panels stay out of these tests.
beforeAll(() => {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
});

const { results, mutations } = jest.requireMock<MockApi>("~/trpc/react");
const { auth } = jest.requireMock<{ auth: { isSignedIn: boolean } }>("~/context/auth-context");

const XSS = '<img src=x onerror="alert(1)">';
const NO_MOD: ModContext = { isSiteAdmin: false, realms: [], categories: [] };

function set(name: string, result: QueryResult) {
  results[name] = result;
}

beforeEach(() => {
  jest.clearAllMocks();
  for (const key of Object.keys(results)) delete results[key];
  for (const key of Object.keys(mutations)) delete mutations[key];
  mutations.markThreadRead = jest.fn().mockResolvedValue({ readAt: null });
  auth.isSignedIn = false;
  set("context", { data: NO_MOD });
  set("isThreadStashed", { data: { stashed: false } });
});
describe("ban notices", () => {
  it("renders a stored notice as text, never as markup", () => {
    const { container } = render(<BanNotice notice={`Banned: ${XSS}`} />);
    expect(screen.getByText(`Banned: ${XSS}`)).toBeInTheDocument();
    expect(container.querySelector("img")).toBeNull();
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
    const { container } = render(<StandingPanel standing={standing as never} />);
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
});
