/**
 * The issue brief: a decision refreshes everything it writes (approval and stability on the
 * country record, the feed, directive progress), Delegate is offered when the issue has no
 * enforced deadline, the meeting toast points at Politics, and "Make Directive" only shows where
 * the sheet can open the composer. Deadlines and research count down on the nation's realm clock.
 */
import { render, screen } from "@testing-library/react";
import { NationClockProvider } from "~/hooks/useNationClock";
import type { RealmClockReader } from "~/lib/realms/realm-clock";
import {
  CLOCK_NOW,
  DAY,
  ixnayReader,
  pausedReader,
  sixTimesReader,
} from "~/tests/fixtures/realm-readers";

const mockData: Record<string, object | undefined> = {};
const mockInvalidated: string[] = [];
const mockMutationOptions: Record<string, { onSuccess?: (res: object) => unknown }> = {};

jest.mock("~/trpc/react", () => {
  const procedure = (path: string) => ({
    useQuery: () => ({ data: mockData[path], isLoading: false, refetch: jest.fn() }),
    useMutation: (options: { onSuccess?: (res: object) => unknown }) => {
      mockMutationOptions[path] = options;
      return { mutate: jest.fn(), isPending: false };
    },
    invalidate: () => {
      mockInvalidated.push(path);
      return Promise.resolve();
    },
  });
  const tree = () =>
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
          ? tree
          : new Proxy({}, { get: (_p, proc: string) => procedure(`${router}.${proc}`) }),
    }
  );
  return { api };
});
const mockNotify = { success: jest.fn(), error: jest.fn() };
jest.mock("~/hooks/useNotify", () => ({ useNotify: () => mockNotify }));

import { IssueDetailBrief } from "~/components/mycountry/shared/headers/IssueDetailBrief";

const option = (id: string) => ({
  id,
  label: `Option ${id}`,
  description: "",
  previewEffects: {},
  outcomeText: "",
});

beforeEach(() => {
  mockInvalidated.length = 0;
  mockData["nationalIssues.getIssue"] = {
    id: "n-1",
    countryId: "c-1",
    title: "Port strike",
    description: "Dock workers walked out.",
    domain: "economic",
    severity: "medium",
    urgency: 40,
    status: "pending",
    // The server drops the deadline while ISSUES_ENFORCE_DEADLINES is off.
    deadlineIxTime: null,
    responseOptions: JSON.stringify([option("a"), option("b")]),
  };
  mockData["nationalIssues.getReconReveal"] = { status: "disabled" };
});

it("offers Delegate and counts the real options", () => {
  render(<IssueDetailBrief issueId="n-1" />);
  expect(screen.getByRole("button", { name: /Delegate/ })).toBeEnabled();
  expect(screen.getByText("2 options")).toBeInTheDocument();
  expect(screen.queryByText(/action pathways/)).not.toBeInTheDocument();
});

it("hides Make Directive when the sheet cannot open the composer", () => {
  const { unmount } = render(<IssueDetailBrief issueId="n-1" />);
  expect(screen.queryByText("Make Directive")).not.toBeInTheDocument();
  unmount();
  render(<IssueDetailBrief issueId="n-1" onDeclare={jest.fn()} />);
  expect(screen.getByText("Make Directive")).toBeInTheDocument();
});

it("refreshes the country, feed and directives after a decision", async () => {
  render(<IssueDetailBrief issueId="n-1" />);
  await mockMutationOptions["nationalIssues.respond"]!.onSuccess!({});
  expect(mockInvalidated).toEqual(
    expect.arrayContaining([
      "countries.getByIdWithEconomicData",
      "mycountry.getCanonFeed",
      "intent.getTree",
      "intent.getLinkedIssues",
      "countries.getActivityRingsData",
    ])
  );
});

it("says where the scheduled meeting lives", () => {
  render(<IssueDetailBrief issueId="n-1" />);
  mockMutationOptions["quickActions.createMeeting"]!.onSuccess!({});
  expect(mockNotify.success).toHaveBeenCalledWith(expect.stringContaining("Cabinet meetings"));
});

it("shows a free-text effect on its chip instead of an empty label", () => {
  mockData["nationalIssues.getIssue"] = {
    ...mockData["nationalIssues.getIssue"],
    responseOptions: JSON.stringify([
      { ...option("a"), previewEffects: { stabilityImpact: "Long-term security" } },
      { ...option("b"), previewEffects: { economicImpact: "positive" } },
    ]),
  };
  render(<IssueDetailBrief issueId="n-1" />);
  expect(screen.getByText("Stability: Long-term security")).toBeInTheDocument();
  expect(screen.getByText("Economy")).toBeInTheDocument();
});

describe("deadlines on the nation's clock", () => {
  const renderWithClock = (clock: RealmClockReader | null, deadlineIxTime: number) => {
    mockData["nationalIssues.getIssue"] = {
      ...mockData["nationalIssues.getIssue"],
      deadlineIxTime,
    };
    mockData["nationalIssues.getReconReveal"] = { status: "pending", readyIxTime: deadlineIxTime };
    return render(
      <NationClockProvider value={clock}>
        <IssueDetailBrief issueId="n-1" />
      </NationClockProvider>
    );
  };

  it("counts in-world days left on Ixnay's clock", () => {
    renderWithClock(ixnayReader(), CLOCK_NOW + 5 * DAY);
    expect(screen.getByText("5 days remaining")).not.toHaveClass("text-destructive-ink");
    expect(screen.getByText(/Findings arrive in 5 day\(s\)/)).toBeInTheDocument();
  });

  it("reads a 6× realm's own clock, urgent sooner in game time", () => {
    // Five in-world days in a 6× realm are under a day of real time: urgent.
    renderWithClock(sixTimesReader(), CLOCK_NOW + 5 * DAY);
    expect(screen.getByText("5 days remaining")).toHaveClass("text-destructive-ink");
  });

  it("shows Paused instead of a countdown in a paused realm", () => {
    renderWithClock(pausedReader(), CLOCK_NOW + 5 * DAY);
    expect(screen.getByText("Paused")).toBeInTheDocument();
    expect(screen.queryByText(/days remaining/)).toBeNull();
    expect(screen.getByText(/findings arrive when the realm resumes/)).toBeInTheDocument();
  });

  it("shows a placeholder while the clock loads", () => {
    renderWithClock(null, CLOCK_NOW + 5 * DAY);
    expect(screen.queryByText(/days remaining/)).toBeNull();
    expect(screen.getByText(/Findings arrive in –/)).toBeInTheDocument();
  });
});

it("labels each recon finding by its operation", () => {
  mockData["nationalIssues.getReconReveal"] = {
    status: "ready",
    options: [
      {
        optionId: "a",
        label: "Option a",
        reveals: [
          { targetField: "alpha", value: null },
          { targetField: "bravo" },
          { targetField: "charlie", value: 1.5, operation: "multiply" },
          { targetField: "delta", value: 40, operation: "set" },
          { targetField: "echo", value: 3, operation: "subtract" },
          { targetField: "foxtrot", value: -3, operation: "add" },
          { targetField: "golf", value: 0, state: "questioned" },
        ],
      },
    ],
  };
  render(<IssueDetailBrief issueId="n-1" />);
  for (const label of [
    "Alpha: —",
    "Bravo: —",
    "Charlie: ×1.5",
    "Delta: =40",
    "Echo: -3",
    "Foxtrot: +3",
    "Golf: +0 ?",
  ]) {
    expect(screen.getByText(label)).toBeInTheDocument();
  }
});
