import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "@jest/globals";

let mockIssues: unknown[] = [];
let mockIntents: unknown[] = [];
let mockElections: unknown[] = [];

const ok = (data: unknown) => ({ data, isLoading: false, isSuccess: true });

jest.mock("~/trpc/react", () => ({
  api: {
    intent: {
      getTree: { useQuery: () => ok({ roots: [], allIntents: mockIntents }) },
    },
    elections: { getElections: { useQuery: () => ok(mockElections) } },
    nationalIssues: { getMyIssues: { useQuery: () => ok({ issues: mockIssues }) } },
  },
}));

import { ExecutiveAgenda } from "~/components/mycountry/shell/ExecutiveAgenda";
import {
  deriveAgendaItems,
  formatAgo,
  formatAgendaTime,
} from "~/components/mycountry/shell/agenda";

const DAY = 86_400_000;
const NOW = Date.UTC(2040, 0, 15, 12);

function issue(id: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    title: `Issue ${id}`,
    description: `What to do about ${id}.\nMore detail.`,
    severity: "medium",
    urgency: 40,
    status: "pending",
    createdAt: new Date(NOW - 2 * 3_600_000),
    ...extra,
  };
}

describe("deriveAgendaItems", () => {
  it("builds items from real issues, active directives and upcoming elections", () => {
    const items = deriveAgendaItems({
      nowIxTime: NOW,
      issues: [
        issue("a"),
        issue("b", { severity: "critical" }),
        issue("c", { deadlineIxTime: NOW + DAY }),
        issue("d", { deadlineIxTime: NOW - 1 }),
      ],
      intents: [
        { id: "i1", goal: "Cut red tape", status: "active", tier: "moderate", progress: 42 },
        { id: "i2", goal: "Old plan", status: "completed" },
      ],
      elections: [
        { id: "e1", name: "General election", scheduledIxTime: NOW + 3 * DAY, status: "upcoming" },
        {
          id: "e2",
          name: "Later vote",
          scheduledIxTime: NOW + 60 * DAY,
          electionType: "referendum",
        },
        { id: "e3", name: "Past vote", scheduledIxTime: NOW + DAY, status: "completed" },
      ],
    });

    // Overdue, due soon, flagged, then newest first; completed items never appear.
    expect(items.map((i) => i.id)).toEqual([
      "issue:d",
      "issue:c",
      "election:e1",
      "issue:b",
      "issue:a",
      "directive:i1",
      "election:e2",
    ]);
    const byId = Object.fromEntries(items.map((i) => [i.id, i]));
    expect(byId["issue:d"]!.urgency).toBe("overdue");
    expect(byId["issue:c"]!.urgency).toBe("due-soon");
    expect(byId["issue:b"]!.flagged).toBe(true);
    expect(byId["issue:a"]!.flagged).toBe(false);
    expect(byId["issue:a"]!.preview).toBe("What to do about a.");
    expect(byId["directive:i1"]!.statusLabel).toBe("Moderate directive");
    expect(byId["directive:i1"]!.preview).toBe("In progress · 42% done");
    expect(byId["election:e1"]!.urgency).toBe("due-soon");
    expect(byId["election:e2"]!.urgency).toBe("upcoming");
    expect(byId["election:e2"]!.statusLabel).toBe("Referendum");
  });

  it("labels time relatively, never as a calendar date or weekday", () => {
    expect(formatAgo(NOW - 30_000, NOW)).toBe("Just now");
    expect(formatAgo(NOW - 5 * 60_000, NOW)).toBe("5m ago");
    expect(formatAgo(NOW - 2 * 3_600_000, NOW)).toBe("2h ago");
    expect(formatAgo(NOW - 3 * DAY, NOW)).toBe("3d ago");
    expect(formatAgo(NOW - 15 * DAY, NOW)).toBe("2w ago");
    expect(formatAgendaTime({ urgency: "overdue", receivedAt: NOW }, NOW)).toBe("Overdue");
    expect(formatAgendaTime({ urgency: "due-soon", receivedAt: NOW }, NOW)).toBe("Due soon");
    expect(formatAgendaTime({ urgency: null, receivedAt: null }, NOW)).toBe("");
  });
});

describe("ExecutiveAgenda", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(NOW);
    mockIssues = [issue("a"), issue("b", { severity: "critical" })];
    mockIntents = [{ id: "i1", goal: "Cut red tape", status: "active", tier: "measured" }];
    mockElections = [];
    window.localStorage.clear();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("lists every open item with its source, flag and relative time", () => {
    render(<ExecutiveAgenda countryId="c1" />);
    const rows = within(screen.getByRole("region", { name: "Agenda" })).getAllByRole("listitem");
    expect(rows).toHaveLength(3);
    expect(screen.getByRole("img", { name: "Needs action" })).toBeTruthy();
    expect(screen.getAllByText("2h ago").length).toBeGreaterThan(0);
    expect(document.body.textContent).not.toMatch(/\b(unread|snooze|mailbox|inbox)\b/i);
  });

  it("opens the matching drill or directive from a row", () => {
    const onOpenDrill = jest.fn();
    const onOpenIntent = jest.fn();
    render(
      <ExecutiveAgenda countryId="c1" onOpenDrill={onOpenDrill} onOpenIntent={onOpenIntent} />
    );
    fireEvent.click(screen.getByRole("button", { name: /^Issue b/ }));
    expect(onOpenDrill).toHaveBeenCalledWith({ kind: "issue", issueId: "b" });
    fireEvent.click(screen.getByRole("button", { name: /^Cut red tape/ }));
    expect(onOpenIntent).toHaveBeenCalledWith("i1");
  });

  it("hides an item once it is marked done", () => {
    render(<ExecutiveAgenda countryId="c1" />);
    fireEvent.click(screen.getByRole("button", { name: "Mark done: Issue a" }));
    expect(screen.queryByText("Issue a")).toBeNull();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });

  it("keeps a dismissed item hidden after remount", () => {
    const first = render(<ExecutiveAgenda countryId="c1" />);
    fireEvent.click(screen.getByRole("button", { name: "Mark done: Issue a" }));
    first.unmount();
    render(<ExecutiveAgenda countryId="c1" />);
    expect(screen.queryByText("Issue a")).toBeNull();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });

  it("says plainly when nothing is waiting", () => {
    mockIssues = [];
    mockIntents = [];
    render(<ExecutiveAgenda countryId="c1" />);
    expect(screen.getByText("Nothing on your agenda")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Declare/ })).toBeNull();
  });
});
