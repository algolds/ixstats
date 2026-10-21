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
