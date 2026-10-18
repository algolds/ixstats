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
  text: "bad words",
  signerName: "@troll",
  reporterName: "@ixnay",
  reason: "slur",
  createdAt: new Date("2026-11-02T12:00:00Z"),
  ...fields,
});

function serve(
  query: { data?: Report[]; isLoading?: boolean; isError?: boolean },
  { pending = false } = {}
) {
  jest.mocked(useNotify).mockReturnValue(notify as never);
  jest.mocked(api.useUtils).mockReturnValue({
    cards: { admin: { compliance: { inscriptionReports: { invalidate } } } },
  } as never);
  jest.mocked(compliance.inscriptionReports.useQuery).mockReturnValue({
    isLoading: false,
    isError: false,
    ...query,
  } as never);
  jest.mocked(compliance.resolveInscriptionReport.useMutation).mockImplementation(((
    options: ResolveOptions
  ) => {
    resolveOptions = options;
    return { mutate, isPending: pending };
  }) as never);
  return render(<InscriptionReports />);
}

const reported = new Date("2026-11-02T12:00:00Z").toLocaleDateString();

beforeEach(() => {
  jest.clearAllMocks();
  resolveOptions = null;
});

it("lists an open report with its inscription, card, both players and the reason", () => {
  serve({ data: [report()] });
  expect(screen.getByText("“bad words”")).toBeInTheDocument();
  expect(screen.getByText("Aurelia · signed by @troll")).toBeInTheDocument();
  expect(screen.getByText("slur")).toBeInTheDocument();
  expect(screen.getByText(`Reported by @ixnay · ${reported}`)).toBeInTheDocument();
});

it("reads a player the queue cannot name as a player", () => {
  serve({ data: [report({ signerName: null, reporterName: null })] });
  expect(screen.getByText("Aurelia · signed by a player")).toBeInTheDocument();
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
    screen.getByText('Aurelia · signed by <a href="https://example.org">me</a>')
  ).toBeInTheDocument();
  expect(screen.getByText(`Reported by **bold** · ${reported}`)).toBeInTheDocument();
  expect(container.querySelector("b, img, a, strong")).toBeNull();
});

it("clears an inscription only once the admin confirms", () => {
  serve({ data: [report()] });
  fireEvent.click(screen.getByRole("button", { name: "Clear inscription on Aurelia" }));
  const dialog = screen.getByRole("alertdialog", { name: "Clear this inscription?" });
  expect(dialog).toHaveTextContent(
    "The text and the signer's name come off this copy of Aurelia, and it can't be signed again. Every open report on it closes."
  );
  expect(mutate).not.toHaveBeenCalled();
  fireEvent.click(within(dialog).getByRole("button", { name: "Clear inscription" }));
  expect(mutate).toHaveBeenCalledWith({ reportId: "r1", action: "clear" });
});

it("clears nothing when the confirmation is cancelled, and gives focus back to its button", async () => {
  serve({ data: [report()] });
  const clear = screen.getByRole("button", { name: "Clear inscription on Aurelia" });
  fireEvent.click(clear);
  fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Cancel" }));
  await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
  expect(clear).toHaveFocus();
  expect(mutate).not.toHaveBeenCalled();
});

it("dismisses a report at once, each row acting on its own report", () => {
  serve({ data: [report(), report({ id: "r2", cardTitle: "Borealis" })] });
  fireEvent.click(screen.getByRole("button", { name: "Dismiss report on Borealis" }));
  expect(mutate).toHaveBeenCalledWith({ reportId: "r2", action: "dismiss" });
  fireEvent.click(screen.getByRole("button", { name: "Dismiss report on Aurelia" }));
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
  expect(screen.getByRole("button", { name: "Clear inscription on Aurelia" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Dismiss report on Aurelia" })).toBeDisabled();
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
