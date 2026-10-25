/**
 * Plan 2026-10-24 Task 12 (A5): the admin list of the inbound sync's quarantined steps (WikiOS settings). Each row
 * shows the step, its page, its attempts and last error; Retry runs it again (applied or failed again), Dismiss asks
 * first. One busy state disables every button while an action runs, and a failure is announced (role="alert").
 */
import { act, fireEvent, render, screen, within } from "@testing-library/react";

const mockNotify = { success: jest.fn(), error: jest.fn(), info: jest.fn() };
const mockInvalidate = jest.fn();
const mockRetry = { mutate: jest.fn(), isPending: false };
const mockDismiss = { mutate: jest.fn(), isPending: false };
const mockResync = { mutate: jest.fn(), isPending: false };
let mockSteps: object[] | undefined = [];
interface MutationOptions {
  onSuccess: (data: { outcome?: string }) => void;
  onError: (error: { message: string }) => void;
}
let mockRetryOptions: MutationOptions;
let mockDismissOptions: MutationOptions;
let mockResyncOptions: MutationOptions;

jest.mock("~/hooks/useNotify", () => ({ useNotify: () => mockNotify }));
jest.mock("~/trpc/react", () => ({
  api: {
    useUtils: () => ({ wikios: { getQuarantinedSyncSteps: { invalidate: mockInvalidate } } }),
    wikios: {
      getQuarantinedSyncSteps: {
        useQuery: () => ({ data: mockSteps, isLoading: mockSteps === undefined }),
      },
      retryQuarantinedSyncStep: {
        useMutation: (options: MutationOptions) => {
          mockRetryOptions = options;
          return mockRetry;
        },
      },
      resyncQuarantinedPage: {
        useMutation: (options: MutationOptions) => {
          mockResyncOptions = options;
          return mockResync;
        },
      },
      dismissQuarantinedSyncStep: {
        useMutation: (options: MutationOptions) => {
          mockDismissOptions = options;
          return mockDismiss;
        },
      },
    },
  },
}));

import { InboundQuarantineSection } from "~/app/admin/wikios-settings/InboundQuarantineSection";

const step = (over: object = {}) => ({
  id: "dl1",
  stepKey: "rc:5",
  stream: "edits",
  subject: "Caphiria",
  label: "Caphiria",
  attempts: 5,
  lastError: "MediaWiki returned HTTP 500",
  quarantinedAt: new Date("2026-10-24T10:00:00Z"),
  stale: false,
  staleReason: null,
  ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockRetry.isPending = false;
  mockDismiss.isPending = false;
  mockResync.isPending = false;
  mockSteps = [
    step(),
    step({
      id: "dl2",
      stepKey: "log:77",
      stream: "log",
      label: "delete/delete Caphiria",
      lastError: "db down",
    }),
  ];
});

const rowOf = (text: string) => screen.getByText(text).closest("tr") as HTMLElement;

describe("InboundQuarantineSection", () => {
  it("lists each quarantined step with its page, attempts and last error", () => {
    render(<InboundQuarantineSection />);

    const edit = rowOf("MediaWiki returned HTTP 500");
    expect(within(edit).getByText("Edit")).toBeTruthy();
    expect(within(edit).getAllByText("Caphiria")).toHaveLength(2);
    expect(within(edit).getByText("5")).toBeTruthy();
    const log = rowOf("db down");
    expect(within(log).getByText("Log event")).toBeTruthy();
    expect(within(log).getByText("delete/delete Caphiria")).toBeTruthy();
  });

  it("says when nothing is quarantined, and waits while loading", () => {
    mockSteps = [];
    const { unmount } = render(<InboundQuarantineSection />);
    expect(screen.getByText(/No quarantined steps/)).toBeTruthy();
    unmount();

    mockSteps = undefined;
    render(<InboundQuarantineSection />);
    expect(screen.queryByText(/No quarantined steps/)).toBeNull();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("retries a step: applied is a success, failed again is announced", () => {
    render(<InboundQuarantineSection />);
    fireEvent.click(within(rowOf("db down")).getByRole("button", { name: /Retry/ }));
    expect(mockRetry.mutate).toHaveBeenCalledWith({ id: "dl2" });

    act(() => mockRetryOptions.onSuccess({ outcome: "applied" }));
    expect(mockNotify.success).toHaveBeenCalledWith("Step applied");
    expect(mockInvalidate).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("a retry that fails again or cannot run shows why in an alert", () => {
    render(<InboundQuarantineSection />);
    fireEvent.click(within(rowOf("db down")).getByRole("button", { name: /Retry/ }));

    act(() => mockRetryOptions.onSuccess({ outcome: "failed" }));
    expect(screen.getByRole("alert").textContent).toMatch(/failed again/);
    expect(mockNotify.success).not.toHaveBeenCalled();
    expect(mockInvalidate).toHaveBeenCalledTimes(1);

    act(() => mockRetryOptions.onError({ message: "A sync is running. Try again in a moment." }));
    expect(screen.getByRole("alert").textContent).toBe("A sync is running. Try again in a moment.");

    // the next action starts with the alert cleared
    fireEvent.click(within(rowOf("db down")).getByRole("button", { name: /Retry/ }));
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("dismisses only after a confirm", () => {
    render(<InboundQuarantineSection />);
    fireEvent.click(within(rowOf("db down")).getByRole("button", { name: /Dismiss/ }));
    expect(mockDismiss.mutate).not.toHaveBeenCalled();

    const dialog = screen.getByRole("alertdialog");
    expect(within(dialog).getByText(/delete\/delete Caphiria/)).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: /Cancel/ }));
    expect(mockDismiss.mutate).not.toHaveBeenCalled();

    fireEvent.click(within(rowOf("db down")).getByRole("button", { name: /Dismiss/ }));
    fireEvent.click(
      within(screen.getByRole("alertdialog")).getByRole("button", { name: /Dismiss step/ })
    );
    expect(mockDismiss.mutate).toHaveBeenCalledWith({ id: "dl2" });

    act(() => mockDismissOptions.onSuccess({}));
    expect(mockNotify.success).toHaveBeenCalledWith("Step dismissed");
    act(() => mockDismissOptions.onError({ message: "No quarantined sync step with that id." }));
    expect(screen.getByRole("alert").textContent).toBe("No quarantined sync step with that id.");
  });

  it.each([
    ["a retry", mockRetry],
    ["a resync", mockResync],
    ["a dismissal", mockDismiss],
  ])("disables every button while %s runs", (_name, mutation) => {
    mutation.isPending = true;
    render(<InboundQuarantineSection />);

    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBe(5);
    for (const button of buttons) expect((button as HTMLButtonElement).disabled).toBe(true);
  });

  it("a retry with nothing left to apply says so, not that it applied (M6)", () => {
    render(<InboundQuarantineSection />);
    fireEvent.click(within(rowOf("db down")).getByRole("button", { name: /Retry/ }));

    act(() => mockRetryOptions.onSuccess({ outcome: "skipped" }));

    expect(mockNotify.info).toHaveBeenCalledWith(
      "The change is no longer on MediaWiki; nothing to apply."
    );
    expect(mockNotify.success).not.toHaveBeenCalled();
    expect(mockInvalidate).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("a stale log step cannot be retried, and says why (C1)", () => {
    const reason =
      "A later classic change of this page was applied; retrying would undo it. Dismiss it instead.";
    mockSteps = [
      step({ id: "dl2", stream: "log", lastError: "db down", stale: true, staleReason: reason }),
    ];
    render(<InboundQuarantineSection />);

    const row = rowOf("db down");
    expect((within(row).getByRole("button", { name: /Retry/ }) as HTMLButtonElement).disabled).toBe(
      true
    );
    expect(within(row).getByText(reason)).toBeTruthy();
    expect(
      (within(row).getByRole("button", { name: /Dismiss/ }) as HTMLButtonElement).disabled
    ).toBe(false);
  });

  it("resyncs the page of an edit (not of a log event), and says how it went (I3)", () => {
    render(<InboundQuarantineSection />);
    expect(within(rowOf("db down")).queryByRole("button", { name: /Resync/ })).toBeNull();

    fireEvent.click(
      within(rowOf("MediaWiki returned HTTP 500")).getByRole("button", {
        name: /Resync page from classic/,
      })
    );
    expect(mockResync.mutate).toHaveBeenCalledWith({ id: "dl1" });

    act(() => mockResyncOptions.onSuccess({ outcome: "applied" }));
    expect(mockNotify.success).toHaveBeenCalledWith("Page resynced from classic");
    act(() => mockResyncOptions.onSuccess({ outcome: "skipped" }));
    expect(mockNotify.info).toHaveBeenCalledWith(
      "The change is no longer on MediaWiki; nothing to apply."
    );
    act(() => mockResyncOptions.onSuccess({ outcome: "failed" }));
    expect(screen.getByRole("alert").textContent).toMatch(/failed again/);
    act(() => mockResyncOptions.onError({ message: "A sync is running. Try again in a moment." }));
    expect(screen.getByRole("alert").textContent).toBe("A sync is running. Try again in a moment.");
    expect(mockInvalidate).toHaveBeenCalledTimes(3);
  });
});
