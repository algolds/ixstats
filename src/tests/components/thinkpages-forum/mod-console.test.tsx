import React from "react";
import { render, screen } from "@testing-library/react";

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

const { results, mutations, invalidated } = jest.requireMock<MockApi>("~/trpc/react");

const XSS = '<img src=x onerror="alert(1)">';
const CAPHIRIA = { id: "rc", slug: "caphiria", name: "Caphiria" };
const REALM_MOD = {
  isSiteAdmin: false,
  realms: [CAPHIRIA],
  categories: [
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
describe("report queue", () => {
  it("renders a stored HTML reason as text", () => {
    set("context", { data: REALM_MOD });
    set("reports", { data: { rows: [report({ reason: XSS, excerpt: XSS })], total: 1, authors } });
    const { container } = renderConsole();
    expect(screen.getAllByText(XSS).length).toBeGreaterThan(0);
    expect(container.querySelector("img")).toBeNull();
  });
});
