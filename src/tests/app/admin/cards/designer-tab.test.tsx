import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";

jest.mock("~/trpc/react", () => ({
  api: {
    useUtils: jest.fn(),
    cards: {
      admin: {
        overview: { realms: { useQuery: jest.fn() } },
        designer: {
          list: { useQuery: jest.fn() },
          save: { useMutation: jest.fn() },
          achievements: { useQuery: jest.fn() },
        },
      },
    },
  },
}));
jest.mock("~/hooks/useNotify", () => ({
  useNotify: () => ({ success: jest.fn(), error: jest.fn() }),
}));

import { api, type RouterOutputs } from "~/trpc/react";
import { DesignerTab } from "~/app/admin/cards/designer";

type Row = RouterOutputs["cards"]["admin"]["designer"]["list"][number];

const designer = api.cards.admin.designer;

const veteran: Row = {
  id: "card-achievement-veteran",
  title: "Veteran",
  description: "Commemorates one year of activity on IxStats.",
  rarity: "EPIC",
  realmId: "default",
  artwork: null,
  isBound: true,
  isRetired: false,
  specialKind: "ACHIEVEMENT_REWARD",
  rewardAchievementKey: "gen-one-year",
  _count: { CardOwnership: 1200 },
};

function serve(list: { data?: Row[]; isError?: boolean }, save = jest.fn()) {
  jest.mocked(api.useUtils).mockReturnValue({
    cards: { admin: { designer: { list: { invalidate: jest.fn() } } } },
  } as never);
  jest
    .mocked(api.cards.admin.overview.realms.useQuery)
    .mockReturnValue({ data: [{ id: "default", name: "Ixnay", isSystem: false }] } as never);
  jest.mocked(designer.list.useQuery).mockReturnValue(list as never);
  jest
    .mocked(designer.achievements.useQuery)
    .mockReturnValue({ data: [{ id: "gen-one-year", title: "Veteran" }] } as never);
  jest
    .mocked(designer.save.useMutation)
    .mockReturnValue({ mutate: save, isPending: false } as never);
  render(<DesignerTab />);
  return save;
}

function openNew(save = jest.fn()) {
  serve({ data: [] }, save);
  fireEvent.click(screen.getByRole("button", { name: "New Special card" }));
  fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Founders' gala" } });
  return save;
}

it("saves an event card, tradeable unless bound", () => {
  const save = openNew();
  fireEvent.click(screen.getByRole("button", { name: "Save card" }));
  expect(save).toHaveBeenCalledWith(
    expect.objectContaining({
      title: "Founders' gala",
      kind: "EVENT",
      isBound: false,
      rewardAchievementKey: null,
      realmId: "default",
      artwork: null,
    })
  );
});

it("binds an achievement reward and waits for its achievement", () => {
  openNew();
  fireEvent.click(screen.getByRole("radio", { name: "Achievement reward" }));
  expect(screen.getByRole("switch", { name: "Bound" })).toBeDisabled();
  expect(screen.getByRole("switch", { name: "Bound" })).toBeChecked();
  expect(screen.getByRole("button", { name: "Save card" })).toBeDisabled();
  expect(screen.getByText("Choose the achievement that awards this card.")).toBeInTheDocument();
});

it("says why it cannot save art that is not an https address", () => {
  const save = openNew();
  fireEvent.change(screen.getByLabelText("Art URL"), { target: { value: "ixwiki.com/gala.png" } });
  expect(screen.getByRole("button", { name: "Save card" })).toBeDisabled();
  expect(screen.getByText("Art is an https:// address.")).toBeInTheDocument();
  expect(save).not.toHaveBeenCalled();
});

it("lists the Special cards and edits one from its stored values", () => {
  const save = serve({ data: [veteran] });
  expect(screen.getByText("Reward for Veteran")).toBeInTheDocument();
  expect(screen.getByText("1,200")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Edit Veteran" }));
  expect(screen.getByLabelText("Title")).toHaveValue("Veteran");
  fireEvent.click(screen.getByRole("button", { name: "Save card" }));
  expect(save).toHaveBeenCalledWith({
    id: "card-achievement-veteran",
    title: "Veteran",
    description: "Commemorates one year of activity on IxStats.",
    rarity: "EPIC",
    kind: "ACHIEVEMENT_REWARD",
    realmId: "default",
    artwork: null,
    isBound: true,
    rewardAchievementKey: "gen-one-year",
  });
});

const choose = (select: string, option: string) => {
  fireEvent.click(screen.getByRole("combobox", { name: select }));
  fireEvent.click(screen.getByRole("option", { name: option }));
};

it("asks why an edit changes the rarity, and sends the reason", () => {
  const save = serve({ data: [veteran] });
  fireEvent.click(screen.getByRole("button", { name: "Edit Veteran" }));
  expect(screen.queryByLabelText("Why the rarity changes")).not.toBeInTheDocument();
  choose("Rarity", "Legendary");
  const saveCard = screen.getByRole("button", { name: "Save card" });
  expect(saveCard).toBeDisabled();
  expect(screen.getByRole("status")).toHaveTextContent("Say why the rarity changes.");
  const reason = screen.getByLabelText("Why the rarity changes");
  fireEvent.change(reason, { target: { value: "  a  " } });
  expect(saveCard).toBeDisabled();
  fireEvent.change(reason, { target: { value: " Two years of the realm " } });
  fireEvent.click(saveCard);
  expect(save).toHaveBeenCalledWith(
    expect.objectContaining({ rarity: "LEGENDARY", reason: "Two years of the realm" })
  );
});

it("asks no reason of a new card's rarity", () => {
  const save = openNew();
  choose("Rarity", "Legendary");
  expect(screen.queryByLabelText("Why the rarity changes")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Save card" }));
  expect(save.mock.calls[0]![0]).not.toHaveProperty("reason");
});

it("drops the reason field once the rarity is back to the stored one", () => {
  serve({ data: [veteran] });
  fireEvent.click(screen.getByRole("button", { name: "Edit Veteran" }));
  choose("Rarity", "Legendary");
  choose("Rarity", "Epic");
  expect(screen.queryByLabelText("Why the rarity changes")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Save card" })).toBeEnabled();
});

it("fixes the kind, binding and achievement of a card players hold", () => {
  serve({ data: [veteran] });
  fireEvent.click(screen.getByRole("button", { name: "Edit Veteran" }));
  expect(
    screen.getByText("Players hold copies of this card, so its kind and binding are fixed.")
  ).toBeInTheDocument();
  for (const kind of ["Event card", "Achievement reward"]) {
    expect(screen.getByRole("radio", { name: kind })).toBeDisabled();
  }
  expect(screen.getByRole("switch", { name: "Bound" })).toBeDisabled();
  expect(screen.getByRole("combobox", { name: "Achievement" })).toBeDisabled();
  expect(screen.getByLabelText("Title")).toBeEnabled();
});

it("lets the kind and binding of a card nobody holds change", () => {
  serve({ data: [{ ...veteran, _count: { CardOwnership: 0 } }] });
  fireEvent.click(screen.getByRole("button", { name: "Edit Veteran" }));
  expect(screen.queryByText(/Players hold copies/)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("radio", { name: "Event card" }));
  expect(screen.getByRole("switch", { name: "Bound" })).toBeEnabled();
});

it("keeps the old seed's rows read-only until the Special card import runs", () => {
  serve({ data: [{ ...veteran, specialKind: null, rewardAchievementKey: null }] });
  expect(screen.getByText("Waiting for the Special card import")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Edit Veteran" })).toBeDisabled();
});

it("announces why the card cannot be saved yet from one live region", () => {
  serve({ data: [] });
  fireEvent.click(screen.getByRole("button", { name: "New Special card" }));
  const status = screen.getByRole("status");
  expect(status).toHaveTextContent("Give the card a title of at least 2 characters.");
  fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Founders' gala" } });
  expect(screen.getByRole("status")).toBe(status);
  expect(status).toBeEmptyDOMElement();
});

it("says when there are no Special cards yet", () => {
  serve({ data: [] });
  expect(screen.getByText("No Special cards yet")).toBeInTheDocument();
});

it("says when the Special cards did not load", () => {
  serve({ isError: true });
  expect(screen.getByRole("alert")).toHaveTextContent("The Special cards did not load");
});
