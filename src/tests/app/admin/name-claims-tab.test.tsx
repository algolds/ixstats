/** Admin: the wiki name claims queue (evidence, the imported groups warning, decisions) and the link-an-old-name sheet. */
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
jest.mock("~/hooks/useNotify", () => {
  const notify = { success: jest.fn(), error: jest.fn() };
  return { useNotify: () => notify };
});
jest.mock("~/trpc/react", () => ({
  api: {
    useUtils: jest.fn(),
    admin: {
      listNameClaims: { useInfiniteQuery: jest.fn() },
      searchLegacyWikiNames: { useQuery: jest.fn() },
      findNameLinkTargets: { useQuery: jest.fn() },
      approveNameClaim: { useMutation: jest.fn() },
      rejectNameClaim: { useMutation: jest.fn() },
      revokeNameClaim: { useMutation: jest.fn() },
      linkLegacyWikiName: { useMutation: jest.fn() },
    },
  },
}));
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { NameClaimsTab } from "~/app/admin/users/NameClaimsTab";
import { LinkLegacyNameSheet } from "~/app/admin/users/LinkLegacyNameSheet";

type Status = "PENDING" | "APPROVED" | "REJECTED" | "REVOKED";

const evidence = (extra: object = {}) => ({
  name: "Foo bar",
  wikiosEdits: 12,
  lorewards: null,
  importedGroups: [] as string[],
  blocked: false,
  owner: null,
  pendingClaims: 1,
  classicEdits: null,
  ...extra,
});

const claim = (id: string, status: Status, nameEvidence: object = {}) => ({
  id,
  userId: "p1",
  name: "Foo bar",
  status,
  visible: true,
  rightsPass: false,
  origin: "PLAYER",
  playerEvidence: "I made the Burgundie pages",
  decisionNote: null,
  createdAt: new Date("2026-10-01T00:00:00Z"),
  decidedAt: null,
  account: { userId: "p1", handle: "player", clerkUserId: "user_1", countryName: "Burgundie" },
  evidence: evidence(nameEvidence),
});

const mutations = {
  approve: jest.fn(),
  reject: jest.fn(),
  revoke: jest.fn(),
  link: jest.fn(),
};
const invalidate = jest.fn();

function mockMutations() {
  const { admin } = api;
  jest
    .mocked(admin.approveNameClaim.useMutation)
    .mockReturnValue({ mutate: mutations.approve, isPending: false } as never);
  jest
    .mocked(admin.rejectNameClaim.useMutation)
    .mockReturnValue({ mutate: mutations.reject, isPending: false } as never);
  jest
    .mocked(admin.revokeNameClaim.useMutation)
    .mockReturnValue({ mutate: mutations.revoke, isPending: false } as never);
  jest
    .mocked(admin.linkLegacyWikiName.useMutation)
    .mockReturnValue({ mutate: mutations.link, isPending: false } as never);
  jest.mocked(api.useUtils).mockReturnValue({ admin: { listNameClaims: { invalidate } } } as never);
}

function mockSearches() {
  jest.mocked(api.admin.searchLegacyWikiNames.useQuery).mockReturnValue({
    data: [evidence({ classicEdits: 40 }), evidence({ name: "Foo baz", wikiosEdits: 0 })],
    isFetching: false,
  } as never);
  jest.mocked(api.admin.findNameLinkTargets.useQuery).mockReturnValue({
    data: [{ userId: "p1", handle: "player", clerkUserId: "user_1", countryName: "Burgundie" }],
    isFetching: false,
  } as never);
}

function renderTab(items: object[], viewerIsSystemOwner = false) {
  jest.mocked(api.admin.listNameClaims.useInfiniteQuery).mockReturnValue({
    data: { pages: [{ items, nextCursor: null, viewerIsSystemOwner }] },
    isLoading: false,
    hasNextPage: false,
    isFetchingNextPage: false,
    fetchNextPage: jest.fn(),
  } as never);
  mockMutations();
  mockSearches();
  return render(<NameClaimsTab />);
}

beforeEach(() => jest.clearAllMocks());

it("shows each claim's account and one evidence line", () => {
  renderTab([claim("c1", "PENDING", { importedGroups: ["sysop"] })]);
  expect(screen.getByText("12 WikiOS edits · Groups: sysop")).toBeInTheDocument();
  expect(screen.getByText("@player · Burgundie")).toBeInTheDocument();
  expect(screen.getByText("I made the Burgundie pages")).toBeInTheDocument();
  expect(api.admin.listNameClaims.useInfiniteQuery).toHaveBeenCalledWith(
    { status: "PENDING", limit: 25 },
    expect.objectContaining({ getNextPageParam: expect.any(Function) })
  );
});

it("joins every known piece of evidence, and names another holder", () => {
  renderTab([
    claim("c1", "PENDING", {
      wikiosEdits: 1,
      classicEdits: 40,
      lorewards: { totalScore: 9, dailyWins: 3, weeklyWins: 1, monthlyWins: 0, places: 5 },
      blocked: true,
      owner: { userId: "p2", handle: "other" },
    }),
  ]);
  expect(
    screen.getByText(
      "1 WikiOS edit · 40 classic edits · 3 daily · 1 weekly · 0 monthly wins · Blocked · Held by @other"
    )
  ).toBeInTheDocument();
});

it("warns that imported groups stay behind only when the viewer is not a system owner", () => {
  const { unmount } = renderTab([claim("c1", "PENDING", { importedGroups: ["sysop"] })]);
  expect(screen.getByText("Imported groups stay behind")).toBeInTheDocument();
  unmount();
  renderTab([claim("c1", "PENDING", { importedGroups: ["sysop"] })], true);
  expect(screen.queryByText("Imported groups stay behind")).toBeNull();
});

it("approves with the typed note, and rejects with no note as null", () => {
  renderTab([claim("c1", "PENDING")]);
  fireEvent.change(screen.getByLabelText("Decision note"), { target: { value: " Checked " } });
  fireEvent.click(screen.getByRole("button", { name: "Approve" }));
  expect(mutations.approve).toHaveBeenCalledWith({ claimId: "c1", note: "Checked" });
  fireEvent.change(screen.getByLabelText("Decision note"), { target: { value: "" } });
  fireEvent.click(screen.getByRole("button", { name: "Reject" }));
  expect(mutations.reject).toHaveBeenCalledWith({ claimId: "c1", note: null });
});

it("offers only Remove on an approved claim, and lists another status when picked", () => {
  renderTab([claim("c2", "APPROVED", { owner: { userId: "p1", handle: "player" } })]);
  expect(screen.queryByRole("button", { name: "Approve" })).toBeNull();
  expect(screen.queryByText(/Held by/)).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Remove" }));
  expect(mutations.revoke).toHaveBeenCalledWith({ claimId: "c2", note: null });
  fireEvent.click(screen.getByRole("radio", { name: "Removed" }));
  expect(api.admin.listNameClaims.useInfiniteQuery).toHaveBeenLastCalledWith(
    { status: "REVOKED", limit: 25 },
    expect.anything()
  );
});

it("says so when a status has no claims", () => {
  renderTab([]);
  expect(screen.getByText("No claims here.")).toBeInTheDocument();
});

it("shows a refusal's message and refreshes the queue after a decision", () => {
  renderTab([claim("c1", "PENDING")]);
  const options = jest.mocked(api.admin.approveNameClaim.useMutation).mock.calls[0]?.[0];
  options?.onError?.(
    { message: "That name already belongs to another account." } as never,
    {} as never,
    undefined,
    {} as never
  );
  expect(useNotify().error).toHaveBeenCalledWith("That name already belongs to another account.");
  options?.onSuccess?.({} as never, {} as never, undefined, {} as never);
  expect(invalidate).toHaveBeenCalled();
});

describe("LinkLegacyNameSheet", () => {
  it("links a picked name to a picked account", async () => {
    mockMutations();
    mockSearches();
    const onOpenChange = jest.fn();
    render(<LinkLegacyNameSheet open onOpenChange={onOpenChange} />);
    expect(screen.getByRole("dialog", { name: "Link an old name" })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Search wiki names"), { target: { value: "Foo" } });
    await waitFor(() =>
      expect(api.admin.searchLegacyWikiNames.useQuery).toHaveBeenLastCalledWith(
        { query: "Foo", limit: 20 },
        { enabled: true }
      )
    );
    expect(screen.getByText("12 WikiOS edits · 40 classic edits")).toBeInTheDocument();
    expect(screen.queryByLabelText("Search accounts")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /^Foo bar/ }));

    fireEvent.change(screen.getByLabelText("Search accounts"), { target: { value: "play" } });
    await waitFor(() =>
      expect(api.admin.findNameLinkTargets.useQuery).toHaveBeenLastCalledWith(
        { query: "play" },
        { enabled: true }
      )
    );
    expect(screen.getByRole("button", { name: "Link name" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: /^@player/ }));
    fireEvent.click(screen.getByRole("button", { name: "Link name" }));
    expect(mutations.link).toHaveBeenCalledWith({
      userId: "p1",
      name: "Foo bar",
      note: null,
      mwUserId: null,
    });

    const options = jest.mocked(api.admin.linkLegacyWikiName.useMutation).mock.calls[0]?.[0];
    act(() => options?.onSuccess?.({} as never, {} as never, undefined, {} as never));
    expect(invalidate).toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
