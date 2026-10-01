import React from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";

// The inbox's sources, reset per test.
let mockIssues: unknown[] = [];
let mockIntents: unknown[] = [];
let mockElections: unknown[] = [];

const ok = (data: unknown) => ({ data, isLoading: false, isSuccess: true });

jest.mock("~/trpc/react", () => ({
  api: {
    intent: {
      getTree: { useQuery: () => ok({ roots: [], allIntents: mockIntents }) },
      getStatus: { useQuery: () => ok({ usedThisWeek: 1, cap: 3, canCommit: true }) },
    },
    elections: { getElections: { useQuery: () => ok(mockElections) } },
    nationalIssues: { getMyIssues: { useQuery: () => ok({ issues: mockIssues }) } },
  },
}));

import { ExecutiveAgenda } from "~/components/mycountry/shell/ExecutiveAgenda";
import {
  deriveAgendaItems,
  formatAgo,
  formatInboxTime,
  inboxStorageKey,
  markDone,
  moveToInbox,
  pruneInbox,
  readInboxStore,
  resolveInbox,
  setRead,
  snooze,
  type AgendaItem,
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
  it("builds inbox items from real issues, active directives and upcoming elections", () => {
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

  it("labels time relatively — never a calendar date or weekday", () => {
    expect(formatAgo(NOW - 30_000, NOW)).toBe("Just now");
    expect(formatAgo(NOW - 5 * 60_000, NOW)).toBe("5m ago");
    expect(formatAgo(NOW - 2 * 3_600_000, NOW)).toBe("2h ago");
    expect(formatAgo(NOW - 3 * DAY, NOW)).toBe("3d ago");
    expect(formatAgo(NOW - 15 * DAY, NOW)).toBe("2w ago");
    expect(formatInboxTime({ urgency: "overdue", receivedAt: NOW }, NOW)).toBe("Overdue");
    expect(formatInboxTime({ urgency: "due-soon", receivedAt: NOW }, NOW)).toBe("Due soon");
    expect(formatInboxTime({ urgency: null, receivedAt: null }, NOW)).toBe("");
  });
});

describe("inbox state", () => {
  const [item] = deriveAgendaItems({ nowIxTime: NOW, issues: [issue("a")] }) as [AgendaItem];

  it("starts unread in the inbox; read, done and snooze move it", () => {
    expect(resolveInbox([item], {}, NOW)[0]).toMatchObject({ read: false, placement: "inbox" });

    const read = setRead({}, [item], true);
    expect(resolveInbox([item], read, NOW)[0]).toMatchObject({ read: true, placement: "inbox" });

    const done = markDone(read, item);
    expect(resolveInbox([item], done, NOW)[0]!.placement).toBe("done");
    expect(resolveInbox([item], moveToInbox(done, item), NOW)[0]!.placement).toBe("inbox");

    const snoozed = snooze(read, item, NOW + DAY);
    expect(resolveInbox([item], snoozed, NOW)[0]!.placement).toBe("snoozed");
    // After the snooze it comes back, unread.
    expect(resolveInbox([item], snoozed, NOW + DAY + 1)[0]).toMatchObject({
      placement: "inbox",
      read: false,
    });
  });

  it("forgets flags when the underlying item changes, and prunes vanished items", () => {
    const done = markDone({}, item);
    const escalated = { ...item, version: "critical|" };
    expect(resolveInbox([escalated], done, NOW)[0]).toMatchObject({
      placement: "inbox",
      read: false,
    });
    expect(pruneInbox(done, [escalated], NOW)).toEqual({});
    expect(pruneInbox(done, [item], NOW)).toBe(done);
  });

  it("treats a viewed issue as already read", () => {
    const [viewed] = deriveAgendaItems({
      nowIxTime: NOW,
      issues: [issue("v", { status: "viewed" })],
    }) as [AgendaItem];
    expect(resolveInbox([viewed], {}, NOW)[0]!.read).toBe(true);
  });
});

describe("ExecutiveAgenda inbox", () => {
  const key = inboxStorageKey("c1");

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(NOW);
    window.localStorage.clear();
    mockIssues = [issue("a"), issue("b", { severity: "critical" })];
    mockIntents = [{ id: "i1", goal: "Cut red tape", status: "active", tier: "measured" }];
    mockElections = [];
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const inboxList = () => screen.getByRole("list", { name: /inbox$/ });

  it("lists items like an inbox with unread count, mailboxes and relative times", () => {
    render(<ExecutiveAgenda countryId="c1" />);
    const rows = within(inboxList()).getAllByRole("listitem");
    expect(rows).toHaveLength(3);
    // Two unread issues (a directive you declared starts read).
    expect(screen.getByTestId("agenda-unread-count").textContent).toContain("2");
    expect(screen.getAllByText("Unread:", { exact: false })).toHaveLength(2);
    expect(screen.getByRole("img", { name: "Needs action" })).toBeTruthy();
    expect(screen.getAllByText("2h ago").length).toBeGreaterThan(0);
    // Mailboxes that have items, with counts.
    const mailbox = screen.getByRole("radiogroup", { name: "Mailbox" });
    const names = within(mailbox)
      .getAllByRole("radio")
      .map((r) => r.getAttribute("aria-label"));
    expect(names).toEqual([
      "All, 3 items",
      "Needs action, 1 item",
      "Issues, 2 items",
      "Directives, 1 item",
    ]);
    // No day strip, weekdays or "today".
    expect(screen.queryByRole("group", { name: "Choose a day" })).toBeNull();
    expect(document.body.textContent).not.toMatch(
      /\b(today|tomorrow|Mon|Tue|Wed|Thu|Fri|Sat|Sun)\b/i
    );

    fireEvent.click(within(mailbox).getByRole("radio", { name: "Directives, 1 item" }));
    expect(within(inboxList()).getAllByRole("listitem")).toHaveLength(1);
  });

  it("marks everything read and remembers it per country", () => {
    const { unmount } = render(<ExecutiveAgenda countryId="c1" />);
    fireEvent.click(screen.getByRole("button", { name: "Mark all as read" }));
    expect(screen.queryByTestId("agenda-unread-count")).toBeNull();
    const stored = readInboxStore("c1");
    expect(stored["issue:a"]?.read).toBe(true);
    expect(stored["issue:b"]?.read).toBe(true);
    unmount();

    render(<ExecutiveAgenda countryId="c1" />);
    expect(screen.queryByTestId("agenda-unread-count")).toBeNull();
    expect(screen.queryByText("Unread:", { exact: false })).toBeNull();
  });

  it("opening an item marks it read; Done archives it until the issue changes", () => {
    const { unmount } = render(<ExecutiveAgenda countryId="c1" />);
    fireEvent.click(screen.getByRole("button", { name: /Issue a/ }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Issue a")).toBeTruthy();
    expect(readInboxStore("c1")["issue:a"]?.read).toBe(true);

    fireEvent.click(within(dialog).getByRole("button", { name: "Done" }));
    expect(within(inboxList()).queryByText("Issue a")).toBeNull();
    expect(screen.getByRole("button", { name: "Show 1 done" })).toBeTruthy();
    expect(JSON.parse(window.localStorage.getItem(key)!)["issue:a"].done).toBe(true);
    unmount();

    // Still done after a reload…
    const again = render(<ExecutiveAgenda countryId="c1" />);
    expect(within(inboxList()).queryByText("Issue a")).toBeNull();
    again.unmount();

    // …until it escalates, when it comes back unread.
    mockIssues = [issue("a", { severity: "critical" }), issue("b", { severity: "critical" })];
    render(<ExecutiveAgenda countryId="c1" />);
    expect(within(inboxList()).getByText("Issue a")).toBeTruthy();
    expect(screen.getAllByText("Unread:", { exact: false })).toHaveLength(2);
  });

  it("snoozes for a day and brings the item back afterwards", () => {
    const { unmount } = render(<ExecutiveAgenda countryId="c1" />);
    fireEvent.click(screen.getByRole("button", { name: /Issue b/ }));
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Snooze a day" })
    );
    expect(within(inboxList()).queryByText("Issue b")).toBeNull();
    expect(screen.getByRole("button", { name: "Show 1 snoozed" })).toBeTruthy();
    unmount();

    act(() => {
      jest.setSystemTime(NOW + DAY + 60_000);
    });
    render(<ExecutiveAgenda countryId="c1" />);
    expect(within(inboxList()).getByText("Issue b")).toBeTruthy();
  });

  it("restores a done item from the archive", () => {
    render(<ExecutiveAgenda countryId="c1" />);
    fireEvent.click(screen.getByRole("button", { name: /Issue a/ }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Done" }));
    fireEvent.click(screen.getByRole("button", { name: "Show 1 done" }));
    fireEvent.click(
      within(screen.getByRole("list", { name: "Snoozed and done" })).getByRole("button", {
        name: /Issue a/,
      })
    );
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Move to inbox" })
    );
    expect(within(inboxList()).getByText("Issue a")).toBeTruthy();
  });

  it("offers the swipe actions from the keyboard (Shift+F10) on any pointer", () => {
    render(<ExecutiveAgenda countryId="c1" />);
    const row = screen.getByRole("button", { name: /Issue a/ });
    fireEvent.keyDown(row, { key: "F10", shiftKey: true });
    const menu = screen.getByRole("menu", { name: "Actions" });
    expect(
      within(menu)
        .getAllByRole("menuitem")
        .map((i) => i.getAttribute("aria-label") ?? i.textContent)
    ).toEqual(["Mark as read", "Snooze for a day", "Done"]);
    fireEvent.click(within(menu).getByRole("menuitem", { name: "Done" }));
    expect(within(inboxList()).queryByText("Issue a")).toBeNull();
    expect(readInboxStore("c1")["issue:a"]?.done).toBe(true);
  });

  it("shows Inbox zero with Declare Directive when nothing is waiting", () => {
    mockIssues = [];
    mockIntents = [];
    const onIssueDirective = jest.fn();
    render(<ExecutiveAgenda countryId="c1" onIssueDirective={onIssueDirective} />);
    expect(screen.getByText("Inbox zero")).toBeTruthy();
    expect(screen.queryByRole("radiogroup", { name: "Mailbox" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Declare Directive" }));
    expect(onIssueDirective).toHaveBeenCalled();
  });
});
