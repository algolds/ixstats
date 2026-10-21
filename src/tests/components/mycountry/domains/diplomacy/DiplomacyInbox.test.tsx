import { fireEvent, render, screen, within } from "@testing-library/react";
import { DiplomacyInbox } from "~/components/mycountry/domains/diplomacy/inbox/DiplomacyInbox";
type QueryState = { data?: unknown; isLoading?: boolean; error?: { message: string } | null };

const DAY = 24 * 60 * 60 * 1000;
const inDays = (n: number) => new Date(Date.now() + n * DAY + 60_000);

let queries: Record<string, QueryState> = {};
const mutations: Record<string, jest.Mock> = {
  respondToForeignPolicyProposal: jest.fn(),
  respondToAllianceInvite: jest.fn(),
  withdrawForeignPolicyProposal: jest.fn(),
  withdrawAllianceInvite: jest.fn(),
};
const refetch = jest.fn();

jest.mock("~/hooks/useNotify", () => ({
  useNotify: () => ({ success: jest.fn(), info: jest.fn(), error: jest.fn(), warning: jest.fn() }),
}));
jest.mock("~/trpc/react", () => {
  const query = (name: string) => ({
    useQuery: () => {
      const q = queries[name] ?? {};
      return {
        data: q.data,
        isLoading: q.isLoading ?? false,
        isError: !!q.error,
        error: q.error ?? null,
        refetch,
      };
    },
  });
  const mutation = (name: string) => ({
    useMutation: () => ({ mutate: mutations[name], isPending: false }),
  });
  const invalidate = { invalidate: jest.fn() };
  return {
    api: {
      useUtils: () => ({
        diplomaticPolicies: new Proxy({}, { get: () => invalidate }),
      }),
      diplomaticPolicies: {
        getForeignPolicyProposals: query("getForeignPolicyProposals"),
        getAllianceInvites: query("getAllianceInvites"),
        getOutgoingForeignPolicyProposals: query("getOutgoingForeignPolicyProposals"),
        getOutgoingAllianceInvites: query("getOutgoingAllianceInvites"),
        respondToForeignPolicyProposal: mutation("respondToForeignPolicyProposal"),
        respondToAllianceInvite: mutation("respondToAllianceInvite"),
        withdrawForeignPolicyProposal: mutation("withdrawForeignPolicyProposal"),
        withdrawAllianceInvite: mutation("withdrawAllianceInvite"),
      },
    },
  };
});

beforeEach(() => {
  queries = {};
  Object.values(mutations).forEach((m) => m.mockClear());
  refetch.mockClear();
});

const section = (name: string) => screen.getByRole("region", { name });

describe("DiplomacyInbox", () => {
  it("lists incoming proposals and invites with Accept / Decline wired to the right calls", () => {
    queries.getForeignPolicyProposals = {
      data: [
        {
          id: "fp1",
          actionType: "free_trade",
          initiator: { id: "A", name: "Alpha" },
          expiresAt: inDays(5),
        },
      ],
    };
    queries.getAllianceInvites = {
      data: [
        {
          allianceId: "al1",
          countryId: "B",
          role: "member",
          alliance: { id: "al1", name: "Northern League" },
          invitedBy: { id: "C", name: "Gamma" },
          expiresAt: inDays(1),
        },
      ],
    };
    render(<DiplomacyInbox countryId="B" />);

    const incoming = section("Incoming");
    expect(within(incoming).getByText("Free trade agreement")).toBeInTheDocument();
    expect(within(incoming).getByText("Proposed by Alpha")).toBeInTheDocument();
    expect(within(incoming).getByText(/Expires in 5 days/)).toBeInTheDocument();
    expect(within(incoming).getByText("Join Northern League")).toBeInTheDocument();
    expect(within(incoming).getByText(/Invited by Gamma/)).toBeInTheDocument();
    expect(within(incoming).getByText(/Expires in 1 day$/)).toBeInTheDocument();

    fireEvent.click(within(incoming).getByRole("button", { name: "Accept: Free trade agreement" }));
    expect(mutations.respondToForeignPolicyProposal).toHaveBeenCalledWith({
      actionId: "fp1",
      choice: "accept",
    });
    fireEvent.click(
      within(incoming).getByRole("button", { name: "Decline: Join Northern League" })
    );
    expect(mutations.respondToAllianceInvite).toHaveBeenCalledWith({
      allianceId: "al1",
      countryId: "B",
      choice: "decline",
    });
  });

  it("lists outgoing items as pending with a Withdraw action", () => {
    queries.getOutgoingForeignPolicyProposals = {
      data: [
        {
          id: "fp2",
          actionType: "military_alliance",
          target: { id: "B", name: "Beta" },
          expiresAt: inDays(10),
        },
      ],
    };
    queries.getOutgoingAllianceInvites = {
      data: [
        {
          allianceId: "al1",
          countryId: "D",
          role: "observer",
          alliance: { id: "al1", name: "League" },
          country: { id: "D", name: "Delta" },
          expiresAt: inDays(3),
        },
      ],
    };
    render(<DiplomacyInbox countryId="A" />);

    const outgoing = section("Outgoing");
    expect(within(outgoing).getByText("To Beta")).toBeInTheDocument();
    expect(within(outgoing).getByText(/Pending · Expires in 10 days/)).toBeInTheDocument();
    expect(within(outgoing).getByText("Alliance invitation (observer)")).toBeInTheDocument();

    fireEvent.click(within(outgoing).getByRole("button", { name: "Withdraw: Military alliance" }));
    expect(mutations.withdrawForeignPolicyProposal).toHaveBeenCalledWith({ actionId: "fp2" });
    fireEvent.click(within(outgoing).getByRole("button", { name: "Withdraw: Delta → League" }));
    expect(mutations.withdrawAllianceInvite).toHaveBeenCalledWith({
      allianceId: "al1",
      countryId: "D",
    });
  });
  it("shows loading and error states (with retry) instead of an empty inbox", () => {
    queries.getForeignPolicyProposals = { isLoading: true };
    queries.getOutgoingAllianceInvites = { error: { message: "boom" } };
    render(<DiplomacyInbox countryId="A" />);
    expect(screen.getByRole("status", { name: "Loading incoming" })).toBeInTheDocument();
    expect(screen.queryByText(/No proposals or invitations are waiting/)).not.toBeInTheDocument();

    const alert = within(section("Outgoing")).getByRole("alert");
    expect(alert).toHaveTextContent("boom");
    fireEvent.click(within(alert).getByRole("button", { name: /Retry/ }));
    expect(refetch).toHaveBeenCalled();
  });
});
