/**
 * The issue brief: a decision refreshes everything it writes (approval and stability on the
 * country record, the feed, directive progress), Delegate is offered when the issue has no
 * enforced deadline, the meeting toast points at Politics, and "Make Directive" only shows where
 * the sheet can open the composer.
 */
import { render, screen } from "@testing-library/react";

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
