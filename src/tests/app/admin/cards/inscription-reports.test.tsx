/** The inscription report queue: open reports as plain text, cleared after a confirmation or dismissed. */
import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

jest.mock("~/hooks/useNotify", () => ({ useNotify: jest.fn() }));
jest.mock("~/trpc/react", () => ({
  api: {
    cards: {
      admin: {
        compliance: {
          inscriptionReports: { useQuery: jest.fn() },
          resolveInscriptionReport: { useMutation: jest.fn() },
        },
      },
    },
    useUtils: jest.fn(),
  },
}));

import { api, type RouterOutputs } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { INSCRIPTION_QUEUE_SIZE } from "~/lib/cards/inscription";
import { InscriptionReports } from "~/app/admin/cards/compliance/InscriptionReports";

type Report = RouterOutputs["cards"]["admin"]["compliance"]["inscriptionReports"][number];
interface ResolveOptions {
  onSuccess: (result: { status: "cleared" | "dismissed" }) => void;
  onError: (error: { message: string }) => void;
}

const compliance = api.cards.admin.compliance;
const notify = { success: jest.fn(), error: jest.fn() };
const invalidate = jest.fn();
const mutate = jest.fn();
let resolveOptions: ResolveOptions | null = null;

const report = (fields: Partial<Report> = {}): Report => ({
  id: "r1",
  ownershipId: "o1",
  cardId: "c1",
  cardTitle: "Aurelia",
  serialNumber: 12,
  text: "bad words",
  signerName: "@troll",
  reporterName: "@ixnay",
  reason: "slur",
  createdAt: new Date("2026-11-02T12:00:00Z"),
  ...fields,
});

/** What the queue's query returns, as after a refresh. */
function queue(query: { data?: Report[]; isLoading?: boolean; isError?: boolean }) {
  jest.mocked(compliance.inscriptionReports.useQuery).mockReturnValue({
    isLoading: false,
    isError: false,
    ...query,
  } as never);
}

function serve(
  query: { data?: Report[]; isLoading?: boolean; isError?: boolean },
  { pending = false } = {},
  ui: React.ReactElement = <InscriptionReports />
) {
  jest.mocked(useNotify).mockReturnValue(notify as never);
  jest.mocked(api.useUtils).mockReturnValue({
    cards: { admin: { compliance: { inscriptionReports: { invalidate } } } },
  } as never);
  queue(query);
  jest.mocked(compliance.resolveInscriptionReport.useMutation).mockImplementation(((
    options: ResolveOptions
  ) => {
    resolveOptions = options;
    return { mutate, isPending: pending };
  }) as never);
  return render(ui);
}

const reported = new Date("2026-11-02T12:00:00Z").toLocaleDateString();

beforeEach(() => {
  jest.clearAllMocks();
  resolveOptions = null;
});

it("lists an open report with its inscription, card, both players and the reason", () => {
  serve({ data: [report()] });
  expect(screen.getByText("“bad words”")).toBeInTheDocument();
  expect(screen.getByText("Aurelia #12 · signed by @troll")).toBeInTheDocument();
  expect(screen.getByText("slur")).toBeInTheDocument();
  expect(screen.getByText(`Reported by @ixnay · ${reported}`)).toBeInTheDocument();
});

it("reads a player the queue cannot name as a player", () => {
  serve({ data: [report({ signerName: null, reporterName: null })] });
  expect(screen.getByText("Aurelia #12 · signed by a player")).toBeInTheDocument();
  expect(screen.getByText(`Reported by a player · ${reported}`)).toBeInTheDocument();
});

it("shows the inscription, the reason and the names as plain text, never as markup", () => {
  const { container } = serve({
    data: [
      report({
        text: "<b>loud</b>",
        reason: "<img src=x onerror=alert(1)>",
        signerName: '<a href="https://example.org">me</a>',
        reporterName: "**bold**",
      }),
    ],
  });
  expect(screen.getByText("“<b>loud</b>”")).toBeInTheDocument();
  expect(screen.getByText("<img src=x onerror=alert(1)>")).toBeInTheDocument();
  expect(
    screen.getByText('Aurelia #12 · signed by <a href="https://example.org">me</a>')
  ).toBeInTheDocument();
  expect(screen.getByText(`Reported by **bold** · ${reported}`)).toBeInTheDocument();
  expect(container.querySelector("b, img, a, strong")).toBeNull();
});

it("clears an inscription only once the admin confirms", () => {
  serve({ data: [report()] });
  fireEvent.click(screen.getByRole("button", { name: "Clear inscription on Aurelia #12" }));
  const dialog = screen.getByRole("alertdialog", { name: "Clear this inscription?" });
  expect(dialog).toHaveTextContent(
    "The text and the signer's name come off Aurelia #12, and it can't be signed again. Every open report on it closes."
  );
  expect(mutate).not.toHaveBeenCalled();
  fireEvent.click(within(dialog).getByRole("button", { name: "Clear inscription" }));
  expect(mutate).toHaveBeenCalledWith({ reportId: "r1", action: "clear" });
});

it("clears nothing when the confirmation is cancelled, and gives focus back to its button", async () => {
  serve({ data: [report()] });
  const clear = screen.getByRole("button", { name: "Clear inscription on Aurelia #12" });
  fireEvent.click(clear);
  fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Cancel" }));
  await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
  expect(clear).toHaveFocus();
  expect(mutate).not.toHaveBeenCalled();
});

it("dismisses a report at once, each row acting on its own report", () => {
  // Two copies of one card: the serial tells their rows apart
  serve({ data: [report(), report({ id: "r2", ownershipId: "o2", serialNumber: 13 })] });
  fireEvent.click(screen.getByRole("button", { name: "Dismiss report on Aurelia #13" }));
  expect(mutate).toHaveBeenCalledWith({ reportId: "r2", action: "dismiss" });
  fireEvent.click(screen.getByRole("button", { name: "Dismiss report on Aurelia #12" }));
  expect(mutate).toHaveBeenLastCalledWith({ reportId: "r1", action: "dismiss" });
});

it("says what was done and refreshes the queue", () => {
  serve({ data: [report()] });
  resolveOptions?.onSuccess({ status: "cleared" });
  expect(notify.success).toHaveBeenLastCalledWith("Inscription cleared");
  resolveOptions?.onSuccess({ status: "dismissed" });
  expect(notify.success).toHaveBeenLastCalledWith("Report dismissed");
  expect(invalidate).toHaveBeenCalledTimes(2);
});

it("says so when another admin handled the report first, and refreshes the queue", () => {
  serve({ data: [report()] });
  resolveOptions?.onError({ message: "This report is already handled." });
  expect(notify.error).toHaveBeenCalledWith(
    "Report not changed",
    "This report is already handled."
  );
  expect(invalidate).toHaveBeenCalledTimes(1);
  expect(notify.success).not.toHaveBeenCalled();
});

it("keeps every action off while one is on its way", () => {
  serve({ data: [report()] }, { pending: true });
  expect(screen.getByRole("button", { name: "Clear inscription on Aurelia #12" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Dismiss report on Aurelia #12" })).toBeDisabled();
});

it("says when no report is open", () => {
  serve({ data: [] });
  expect(screen.getByText("No open reports")).toBeInTheDocument();
  expect(screen.queryByRole("table")).not.toBeInTheDocument();
});

it("announces loading, and says when the reports did not load", () => {
  const { unmount } = serve({ isLoading: true });
  expect(screen.getByRole("status")).toHaveTextContent("Loading reports");
  expect(screen.queryByText("No open reports")).not.toBeInTheDocument();
  unmount();
  serve({ isError: true });
  expect(screen.getByRole("alert")).toHaveTextContent(
    "The reports did not load. Reload the page to try again."
  );
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
});

it("says when the queue shows only the oldest reports it can hold", () => {
  const full = Array.from({ length: INSCRIPTION_QUEUE_SIZE }, (_, i) =>
    report({ id: `r${i}`, serialNumber: i + 1 })
  );
  const note = "The queue shows the oldest 100 open reports at a time.";
  const { unmount } = serve({ data: full });
  expect(screen.getByText(note)).toBeInTheDocument();
  unmount();
  serve({ data: full.slice(1) });
  expect(screen.queryByText(note)).not.toBeInTheDocument();
});

describe("focus once a report leaves the queue", () => {
  const second = () => report({ id: "r2", ownershipId: "o2", serialNumber: 13 });

  it("moves to the next row's action after a dismiss, and to the heading after the last row", () => {
    const view = serve({ data: [report(), second()] });
    const dismiss = screen.getByRole("button", { name: "Dismiss report on Aurelia #12" });
    dismiss.focus();
    fireEvent.click(dismiss);
    queue({ data: [second()] });
    view.rerender(<InscriptionReports />);
    expect(screen.getByRole("button", { name: "Clear inscription on Aurelia #13" })).toHaveFocus();

    const last = screen.getByRole("button", { name: "Dismiss report on Aurelia #13" });
    last.focus();
    fireEvent.click(last);
    queue({ data: [] });
    view.rerender(<InscriptionReports />);
    expect(screen.getByText("Reported inscriptions")).toHaveFocus();
  });

  it("moves to the heading after a confirmed clear of the bottom row", async () => {
    const view = serve({ data: [second(), report()] });
    const clear = screen.getByRole("button", { name: "Clear inscription on Aurelia #12" });
    clear.focus();
    fireEvent.click(clear);
    fireEvent.click(
      within(screen.getByRole("alertdialog")).getByRole("button", { name: "Clear inscription" })
    );
    await waitFor(() => expect(clear).toHaveFocus());
    queue({ data: [second()] });
    view.rerender(<InscriptionReports />);
    expect(screen.getByText("Reported inscriptions")).toHaveFocus();
  });

  it("leaves focus where the admin moved it, and moves nothing for a row still there", () => {
    const view = serve({ data: [report(), second()] });
    fireEvent.click(screen.getByRole("button", { name: "Dismiss report on Aurelia #12" }));
    const elsewhere = screen.getByRole("button", { name: "Dismiss report on Aurelia #13" });
    elsewhere.focus();
    queue({ data: [second()] });
    view.rerender(<InscriptionReports />);
    expect(elsewhere).toHaveFocus();

    const kept = screen.getByRole("button", { name: "Dismiss report on Aurelia #13" });
    kept.focus();
    fireEvent.click(kept);
    kept.blur();
    view.rerender(<InscriptionReports />);
    expect(document.body).toHaveFocus();
  });

  it("moves focus once, not again on a later render after the admin leaves it", () => {
    const view = serve({ data: [report(), second()] });
    const dismiss = screen.getByRole("button", { name: "Dismiss report on Aurelia #12" });
    dismiss.focus();
    fireEvent.click(dismiss);
    queue({ data: [second()] });
    view.rerender(<InscriptionReports />);
    const next = screen.getByRole("button", { name: "Clear inscription on Aurelia #13" });
    expect(next).toHaveFocus();
    next.blur();
    view.rerender(<InscriptionReports />);
    expect(document.body).toHaveFocus();
  });

  it("moves focus before an enclosing focus trap can catch it", () => {
    const view = serve({ data: [report(), second()] }, {}, <WithTrap trapping={false} />);
    const dismiss = screen.getByRole("button", { name: "Dismiss report on Aurelia #12" });
    dismiss.focus();
    fireEvent.click(dismiss);
    queue({ data: [second()] });
    view.rerender(<WithTrap trapping />);
    expect(screen.getByRole("button", { name: "Clear inscription on Aurelia #13" })).toHaveFocus();
  });
});

/**
 * The queue beside a stand-in for an enclosing sheet's focus trap, which takes focus lost to the page as soon as the
 * DOM changes: a sibling's layout effect, which runs after the queue's and before any passive effect.
 */
function WithTrap({ trapping }: { trapping: boolean }) {
  return (
    <>
      <InscriptionReports />
      {trapping && <FocusTrap />}
    </>
  );
}

function FocusTrap() {
  const trap = React.useRef<HTMLButtonElement>(null);
  React.useLayoutEffect(() => {
    if (document.activeElement === document.body) trap.current?.focus();
  });
  return <button ref={trap}>Sheet</button>;
}
