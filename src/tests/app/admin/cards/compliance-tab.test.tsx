import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";

jest.mock("~/trpc/react", () => ({
  api: {
    useUtils: jest.fn(),
    cards: {
      admin: {
        overview: { findCards: { useQuery: jest.fn() } },
        compliance: {
          takedowns: { useQuery: jest.fn() },
          file: { useMutation: jest.fn() },
          hide: { useMutation: jest.fn() },
          decline: { useMutation: jest.fn() },
          restore: { useMutation: jest.fn() },
          licences: { useQuery: jest.fn() },
          setLicence: { useMutation: jest.fn() },
        },
      },
    },
  },
}));
jest.mock("~/hooks/useNotify", () => ({
  useNotify: () => ({ success: jest.fn(), error: jest.fn() }),
}));

import { api, type RouterOutputs } from "~/trpc/react";
import { ComplianceTab } from "~/app/admin/cards/compliance";

type Takedown = RouterOutputs["cards"]["admin"]["compliance"]["takedowns"][number];
type LicenceRow = RouterOutputs["cards"]["admin"]["compliance"]["licences"]["rows"][number];

const compliance = api.cards.admin.compliance;
const mutations = {
  file: jest.fn(),
  hide: jest.fn(),
  decline: jest.fn(),
  restore: jest.fn(),
  setLicence: jest.fn(),
};

const takedown = (fields: Partial<Takedown> = {}): Takedown => ({
  id: "td_1",
  origin: "AUTHOR_REQUEST",
  status: "OPEN",
  reason: "I drew this",
  contact: "a@b.c",
  receivedAt: new Date("2026-10-01T00:00:00Z"),
  dueAt: new Date("2026-10-15T00:00:00Z"),
  resolvedAt: null,
  resolutionNote: null,
  card: { id: "card_1", title: "Union Assembly", cardType: "LORE", wikiSource: "iiwiki" },
  ...fields,
});

const licenceRow = (fields: Partial<LicenceRow> = {}): LicenceRow => ({
  cardId: "card_2",
  wiki: "althistory",
  fileTitle: "File:Map.png",
  descriptionUrl: null,
  licence: "CC BY-NC 3.0",
  note: null,
  card: { title: "Old Map", artwork: "https://example.org/Map.png" },
  ...fields,
});

function serve(options: {
  takedowns?: Takedown[];
  takedownsError?: boolean;
  licences?: LicenceRow[];
  matches?: Array<{ id: string; title: string; cardType: string; rarity: string }>;
}) {
  jest.mocked(api.useUtils).mockReturnValue({
    cards: {
      admin: {
        overview: { summary: { invalidate: jest.fn() } },
        compliance: { takedowns: { invalidate: jest.fn() }, licences: { invalidate: jest.fn() } },
      },
    },
  } as never);
  jest
    .mocked(api.cards.admin.overview.findCards.useQuery)
    .mockReturnValue({ data: options.matches ?? [] } as never);
  jest.mocked(compliance.takedowns.useQuery).mockReturnValue({
    data: options.takedownsError ? undefined : (options.takedowns ?? []),
    isError: options.takedownsError ?? false,
  } as never);
  jest.mocked(compliance.licences.useQuery).mockReturnValue({
    data: { rows: options.licences ?? [], total: options.licences?.length ?? 0 },
    isError: false,
  } as never);
  for (const [name, mutate] of Object.entries(mutations)) {
    jest
      .mocked(compliance[name as keyof typeof mutations].useMutation)
      .mockReturnValue({ mutate, isPending: false } as never);
  }
}

beforeEach(() => jest.clearAllMocks());

describe("ComplianceTab takedowns", () => {
  it("shows an overdue request with its card's source, and hides its art", () => {
    serve({ takedowns: [takedown()] });
    render(<ComplianceTab />);

    expect(compliance.takedowns.useQuery).toHaveBeenCalledWith({ status: "OPEN" });
    expect(screen.getByText("Overdue")).toBeInTheDocument();
    expect(screen.getByText("IIWiki")).toBeInTheDocument();
    expect(screen.getByText("Author")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Hide art" }));
    expect(mutations.hide).toHaveBeenCalledWith({ takedownId: "td_1" });
  });

  it("declines a request with the reason the admin gives", () => {
    serve({ takedowns: [takedown()] });
    render(<ComplianceTab />);

    fireEvent.click(screen.getByRole("button", { name: "Decline" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Reason"), {
      target: { value: "We hold a licence" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Decline" }));
    expect(mutations.decline).toHaveBeenCalledWith({
      takedownId: "td_1",
      note: "We hold a licence",
    });
  });

  it("restores hidden art from the art hidden view, where nothing is overdue", () => {
    serve({ takedowns: [takedown({ status: "HIDDEN", resolvedAt: new Date("2026-10-02") })] });
    render(<ComplianceTab />);

    fireEvent.click(screen.getByRole("radio", { name: "Art hidden" }));
    expect(compliance.takedowns.useQuery).toHaveBeenLastCalledWith({ status: "HIDDEN" });
    expect(screen.queryByText("Overdue")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Hide art" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Restore art" }));
    expect(mutations.restore).toHaveBeenCalledWith({ takedownId: "td_1" });
  });

  it("files a takedown for any card the search finds", () => {
    serve({
      takedowns: [],
      matches: [{ id: "card_9", title: "Elm", cardType: "LORE", rarity: "RARE" }],
    });
    render(<ComplianceTab />);
    expect(screen.getByText("No takedowns here")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "File a takedown" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Card"), { target: { value: "elm" } });
    expect(api.cards.admin.overview.findCards.useQuery).toHaveBeenLastCalledWith(
      { query: "elm" },
      { enabled: true }
    );
    fireEvent.click(within(dialog).getByRole("button", { name: /^Elm/ }));
    // Once a card is chosen there is no field to label, so no label points at one
    expect(dialog.querySelector('label[for="takedown-card"]')).toBeNull();
    expect(within(dialog).getByText("Card")).toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText("Reason"), {
      target: { value: "The author asked by email" },
    });
    fireEvent.change(within(dialog).getByLabelText("Contact"), { target: { value: "a@b.c" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "File takedown" }));

    expect(mutations.file).toHaveBeenCalledWith({
      cardId: "card_9",
      origin: "AUTHOR_REQUEST",
      reason: "The author asked by email",
      contact: "a@b.c",
      receivedAt: expect.any(Date),
      hideNow: false,
    });
  });

  it("says when the takedowns did not load", () => {
    serve({ takedownsError: true });
    render(<ComplianceTab />);
    expect(screen.getByRole("alert")).toHaveTextContent("The takedowns did not load");
    expect(screen.queryByText("No takedowns here")).not.toBeInTheDocument();
  });
});

describe("ComplianceTab licence review", () => {
  const openLicences = () => {
    render(<ComplianceTab />);
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Licence review" }), { button: 0 });
  };

  it("marks an unknown licence restricted, starting from the licence on record", () => {
    serve({ licences: [licenceRow()] });
    openLicences();

    expect(compliance.licences.useQuery).toHaveBeenCalledWith({ status: "UNKNOWN" });
    expect(screen.getByText("AltHistory Wiki")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Mark restricted" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByLabelText("Licence")).toHaveValue("CC BY-NC 3.0");
    expect(within(dialog).getByText(/hides the art/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));

    expect(mutations.setLicence).toHaveBeenCalledWith({
      cardId: "card_2",
      status: "RESTRICTED",
      licence: "CC BY-NC 3.0",
      note: undefined,
    });
  });

  it("offers to hide restricted art that still shows, and only to mark open once it is hidden", () => {
    serve({
      licences: [
        licenceRow(),
        licenceRow({ cardId: "card_3", card: { title: "Hidden Map", artwork: null } }),
      ],
    });
    openLicences();
    fireEvent.click(screen.getByRole("radio", { name: "Restricted" }));

    expect(compliance.licences.useQuery).toHaveBeenLastCalledWith({ status: "RESTRICTED" });
    expect(screen.getAllByRole("button", { name: "Mark open" })).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: "Hide art" })).toHaveLength(1);
  });

  it("marks a licence open with the licence the admin types", () => {
    serve({ licences: [licenceRow({ licence: null })] });
    openLicences();

    fireEvent.click(screen.getByRole("button", { name: "Mark open" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("button", { name: "Save" })).toBeDisabled();
    fireEvent.change(within(dialog).getByLabelText("Licence"), {
      target: { value: "CC BY-SA 3.0" },
    });
    fireEvent.change(within(dialog).getByLabelText("Note"), {
      target: { value: "Uploader confirmed" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));

    expect(mutations.setLicence).toHaveBeenCalledWith({
      cardId: "card_2",
      status: "OPEN",
      licence: "CC BY-SA 3.0",
      note: "Uploader confirmed",
    });
  });
});
