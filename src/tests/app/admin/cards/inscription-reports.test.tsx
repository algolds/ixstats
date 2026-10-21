/** The inscription report queue: open reports as plain text, cleared after a confirmation or dismissed. */
import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";

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
const compliance = api.cards.admin.compliance;
const notify = { success: jest.fn(), error: jest.fn() };
const invalidate = jest.fn();
const mutate = jest.fn();

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
  jest.mocked(compliance.resolveInscriptionReport.useMutation).mockImplementation((() => ({
    mutate,
    isPending: pending,
  })) as never);
  return render(ui);
}

const reported = new Date("2026-11-02T12:00:00Z").toLocaleDateString();

beforeEach(() => {
  jest.clearAllMocks();
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
