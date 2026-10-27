/**
 * Directive detail: Complete is off while linked resistance is open (the server refuses it), the
 * broker card names the broker the server weighs for the category and its real state, the
 * country-wide "Decision tree" is gone, and the feed share prefills this nation and the right verb.
 */
import { render, screen } from "@testing-library/react";

const mockData: Record<string, object | undefined> = {};
const mockLoading: Record<string, boolean> = {};

jest.mock("~/trpc/react", () => {
  const procedure = (path: string) => ({
    useQuery: () => ({
      data: mockData[path],
      isLoading: mockLoading[path] ?? false,
      refetch: jest.fn(),
    }),
    useMutation: () => ({ mutate: jest.fn(), isPending: false }),
    invalidate: jest.fn(),
  });
  const routers = () =>
    new Proxy(
      {},
      {
        get: (_r, router: string) =>
          new Proxy({}, { get: (_p, proc: string) => procedure(`${router}.${proc}`) }),
      }
    );
  const api = new Proxy(
    {},
    {
      get: (_r, router: string) =>
        router === "useUtils"
          ? routers
          : new Proxy({}, { get: (_p, proc: string) => procedure(`${router}.${proc}`) }),
    }
  );
  return { api };
});
jest.mock("~/hooks/useNotify", () => ({
  useNotify: () => ({ success: jest.fn(), error: jest.fn() }),
}));
jest.mock("~/components/mycountry/shared/primitives", () => ({
  useCountryData: () => ({ country: { id: "c-1", name: "Eldoria", slug: "eldoria" } }),
}));
jest.mock("~/components/action-links/ShareToRealmButton", () => ({
  ShareToRealmButton: () => null,
}));
jest.mock("~/components/mycountry/shell/IntentDiscussions", () => ({
  IntentDiscussions: () => null,
}));

import { IntentDetail } from "~/components/mycountry/shell/IntentDetail";
import { ThinkPagesShareModal } from "~/components/mycountry/shared/modals/ThinkPagesShareModal";

const intent = {
  id: "i-1",
  goal: "Expand public clinics",
  tier: "measured",
  category: "social",
  status: "active",
  createdAt: new Date("2026-10-01").toISOString(),
  parentId: null,
  summary: null,
  changesJson: null,
  target: null,
};

beforeEach(() => {
  for (const key of Object.keys(mockData)) delete mockData[key];
  for (const key of Object.keys(mockLoading)) delete mockLoading[key];
  mockData["intent.getTree"] = { roots: [intent], allIntents: [intent] };
  mockData["intent.getLinkedIssues"] = {
    issues: [{ id: "n-1", title: "Doctors strike", status: "pending" }],
    resolvedCount: 0,
    totalCount: 1,
    progress: 0,
  };
  mockData["elections.getPowerBrokers"] = [
    { id: "party", name: "The Party", unlocked: true, satisfied: true },
    { id: "technocrats", name: "The Technocrats", unlocked: true, satisfied: false },
  ];
});

describe("IntentDetail", () => {
  it("turns Complete off while resistance is open", () => {
    render(<IntentDetail countryId="c-1" intentId="i-1" />);
    expect(screen.getByRole("button", { name: /Complete directive/ })).toBeDisabled();
  });

  it("names the server's broker for the category, with its real state", () => {
    render(<IntentDetail countryId="c-1" intentId="i-1" />);
    expect(screen.getByText("The Technocrats")).toBeInTheDocument();
    expect(screen.getByText("Wants more funding")).toBeInTheDocument();
    expect(screen.queryByText("Cabinet aligned")).not.toBeInTheDocument();
    expect(screen.queryByText("Decision tree")).not.toBeInTheDocument();
  });

  it("shows loading, not an error, while the tree loads", () => {
    mockData["intent.getTree"] = undefined;
    mockLoading["intent.getTree"] = true;
    render(<IntentDetail countryId="c-1" intentId="i-1" />);
    expect(screen.queryByText("This directive could not be loaded.")).not.toBeInTheDocument();
  });
});

describe("ThinkPagesShareModal", () => {
  it("prefills this nation and says declared for an active directive", () => {
    render(
      <ThinkPagesShareModal
        isOpen
        onClose={jest.fn()}
        intentId="i-1"
        countryId="c-1"
        goal="Expand public clinics"
        tier="measured"
        category="social"
        countryName="Eldoria"
        countrySlug="eldoria"
        status="active"
      />
    );
    const draft = (screen.getByLabelText(/Post draft/) as HTMLTextAreaElement).value;
    expect(draft).toContain('Eldoria declared a measured Directive: "Expand public clinics"');
    expect(draft).toContain("#eldoria");
    expect(draft).not.toContain("The Government");
  });
});
