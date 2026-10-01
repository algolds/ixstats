import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import MovePagePage from "~/app/(wiki-os)/util/move/page";
import DeletePagePage from "~/app/(wiki-os)/util/delete/page";
import ProtectPagePage from "~/app/(wiki-os)/util/protect/page";
import LogPage from "~/app/(wiki-os)/util/log/page";

// Plan 409: the page-admin screens call the page-admin router with what the form holds, and only offer
// themselves to someone holding the right.
const mockPush = jest.fn();
let mockSearch = "title=Old_name";
let mockRights: string[] = [];
let mockRestrictions: Array<{ action: string; level: string; expiresAt: Date | null }> = [];
let mockLogPages: Array<{ entries: object[]; nextCursor: string | null }> = [];
const mockMove = jest.fn();
const mockDelete = jest.fn();
const mockProtect = jest.fn();
const mockLogInput = jest.fn();

jest.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(mockSearch),
  useRouter: () => ({ push: mockPush, replace: jest.fn() }),
}));
jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));
jest.mock("~/components/wiki-os/shared/WikiOSLayout", () => ({
  WikiOSLayout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
jest.mock("~/hooks/useNotify", () => ({
  useNotify: () => ({ success: jest.fn(), error: jest.fn(), warning: jest.fn(), info: jest.fn() }),
}));
jest.mock("~/trpc/react", () => ({
  api: {
    wikios: {
      getUserPermissions: {
        useQuery: () => ({ data: { rights: mockRights }, isLoading: false }),
      },
      getPageRestrictions: {
        useQuery: () => ({ data: { title: "Old name", restrictions: mockRestrictions } }),
      },
      movePage: { useMutation: () => ({ mutate: mockMove, isPending: false }) },
      deletePage: { useMutation: () => ({ mutate: mockDelete, isPending: false }) },
      protectPage: { useMutation: () => ({ mutate: mockProtect, isPending: false }) },
      getLog: {
        useInfiniteQuery: (input: object) => {
          mockLogInput(input);
          return {
            data: { pages: mockLogPages },
            isLoading: false,
            error: null,
            hasNextPage: false,
            fetchNextPage: jest.fn(),
            isFetchingNextPage: false,
          };
        },
      },
    },
  },
}));

// Radix's form controls measure themselves; jsdom has no ResizeObserver.
beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

beforeEach(() => {
  jest.clearAllMocks();
  mockSearch = "title=Old_name";
  mockRights = [];
  mockRestrictions = [];
  mockLogPages = [];
});

describe("the rights gate", () => {
  it.each([
    ["Move", MovePagePage, /move page/i],
    ["Delete", DeletePagePage, /delete page/i],
    ["Protect", ProtectPagePage, /save protection/i],
  ])("%s shows no form to someone without the right", (_name, Page, button) => {
    render(<Page />);
    expect(screen.getByText(/permission needed/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: button })).not.toBeInTheDocument();
  });
});

describe("Move page", () => {
  it("submits the form with the page from the link and the chosen options", () => {
    mockRights = ["move"];
    render(<MovePagePage />);
    expect(screen.getByLabelText("Current title")).toHaveValue("Old name");

    fireEvent.change(screen.getByLabelText("New title"), { target: { value: "New name" } });
    fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "tidy" } });
    fireEvent.click(screen.getByLabelText(/move the talk page/i));
    fireEvent.click(screen.getByRole("button", { name: "Move page" }));

    expect(mockMove).toHaveBeenCalledWith({
      from: "Old name",
      to: "New name",
      reason: "tidy",
      leaveRedirect: true,
      moveTalk: false,
    });
  });

  it("cannot be submitted without a destination", () => {
    mockRights = ["move"];
    mockSearch = "";
    render(<MovePagePage />);
    expect(screen.getByRole("button", { name: "Move page" })).toBeDisabled();
  });
});

describe("Delete page", () => {
  it("deletes the page named in the link, with the reason", () => {
    mockRights = ["delete"];
    render(<DeletePagePage />);
    fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "spam" } });
    fireEvent.click(screen.getByRole("button", { name: "Delete page" }));
    expect(mockDelete).toHaveBeenCalledWith({ title: "Old name", reason: "spam" });
  });
});

describe("Protect page", () => {
  it("asks for no protection by default", () => {
    mockRights = ["protect"];
    render(<ProtectPagePage />);
    fireEvent.click(screen.getByRole("button", { name: "Save protection" }));
    expect(mockProtect).toHaveBeenCalledWith({
      title: "Old name",
      reason: "",
      restrictions: [
        { action: "edit", level: null, expiresAt: null },
        { action: "move", level: null, expiresAt: null },
        { action: "upload", level: null, expiresAt: null },
        { action: "create", level: null, expiresAt: null },
      ],
    });
  });

  it("starts from the protection the page has and keeps its expiry unless changed", async () => {
    mockRights = ["protect"];
    const until = new Date("2027-01-01T00:00:00Z");
    mockRestrictions = [{ action: "edit", level: "sysop", expiresAt: until }];
    render(<ProtectPagePage />);

    fireEvent.click(screen.getByRole("button", { name: "Save protection" }));

    await waitFor(() => expect(mockProtect).toHaveBeenCalled());
    const { restrictions } = mockProtect.mock.calls[0][0] as {
      restrictions: Array<{ action: string; level: string | null; expiresAt: Date | null }>;
    };
    expect(restrictions.find((r) => r.action === "edit")).toEqual({
      action: "edit",
      level: "sysop",
      expiresAt: until,
    });
    expect(restrictions.filter((r) => r.level !== null)).toHaveLength(1);
  });
});

describe("Log", () => {
  const entry = (overrides: object) => ({
    id: "1",
    type: "move",
    action: "move",
    title: "New",
    actor: "Mod",
    comment: null,
    params: { oldTitle: "Old", newTitle: "New" },
    timestamp: new Date("2026-09-30T12:00:00Z"),
    ...overrides,
  });

  it("lists entries in the log's voice with the actor and comment", () => {
    mockLogPages = [
      {
        entries: [
          entry({ comment: "tidy" }),
          entry({ id: "2", type: "block", action: "unblock", title: "User:Bob", params: null }),
        ],
        nextCursor: null,
      },
    ];
    render(<LogPage />);
    expect(screen.getByText(/moved page "Old" to "New"/)).toBeInTheDocument();
    expect(screen.getByText("(tidy)")).toBeInTheDocument();
    expect(screen.getByText(/unblocked Bob/)).toBeInTheDocument();
    expect(screen.getAllByText("Mod")).toHaveLength(2);
  });

  it("starts from the filters in the link, and says when nothing matches", () => {
    mockSearch = "type=protect&title=Caphiria&user=Mod";
    render(<LogPage />);
    expect(mockLogInput).toHaveBeenCalledWith({
      type: "protect",
      title: "Caphiria",
      user: "Mod",
      limit: 50,
    });
    expect(screen.getByText(/no log entries match/i)).toBeInTheDocument();
  });

  it("ignores a type it does not know", () => {
    mockSearch = "type=bogus";
    render(<LogPage />);
    expect(mockLogInput).toHaveBeenCalledWith(expect.objectContaining({ type: undefined }));
  });
});
