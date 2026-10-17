/** Cards refresh §3 UX details: the NS import consent lives in /vault/import's confirm step. */
import { fireEvent, render, screen } from "@testing-library/react";
import type React from "react";
import {
  ImportCompleteStep,
  ImportConfirmStep,
} from "~/components/vault/sections/import/ImportConfirmStep";
import type { CardFaceData } from "~/lib/cards/face/types";

jest.mock("motion/react", () => {
  const still = (Tag: "div" | "h2" | "p") =>
    function Still({ children }: { children?: React.ReactNode }) {
      return <Tag>{children}</Tag>;
    };
  return { motion: { div: still("div"), h2: still("h2"), p: still("p") } };
});
jest.mock("~/components/ui/number-flow", () => ({ NumberFlowDisplay: () => null }));

const face = (n: number): CardFaceData => ({
  cardId: `card_ns_${n}_s3`,
  title: n === 1 ? "Testlandia" : `Nation ${n}`,
  rarity: "RARE",
  cardType: "NS",
  realm: {
    id: "nationstates",
    slug: "nationstates",
    name: "NationStates",
    crestUrl: null,
    isSystem: true,
  },
  artwork: "https://www.nationstates.net/images/flags/testlandia.png",
  silhouette: false,
  number: 12,
  season: 3,
  isRetired: false,
  copy: { ownershipId: `o${n}`, finish: "STANDARD", serialNumber: 1, level: 1 },
});

describe("NS import confirm step", () => {
  it("imports only once the owner allows IxStats to show the nation's flag and cards", () => {
    const onConfirmImport = jest.fn();
    render(
      <ImportConfirmStep nationName="Kiro" onBack={jest.fn()} onConfirmImport={onConfirmImport} />
    );
    const importButton = screen.getByRole("button", { name: /import deck/i });
    expect(importButton).toBeDisabled();
    fireEvent.click(screen.getByRole("checkbox"));
    expect(importButton).toBeEnabled();
    fireEvent.click(importButton);
    expect(onConfirmImport).toHaveBeenCalledTimes(1);
  });
});

describe("NS import complete step", () => {
  it("shows the imported cards as their faces", () => {
    render(
      <ImportCompleteStep
        importResult={{
          cardsImported: 1,
          bonusCredits: 50,
          nation: "Testlandia",
          faces: [face(1)],
        }}
        onReset={jest.fn()}
      />
    );
    expect(
      screen.getByRole("img", { name: "Testlandia, Rare, Standard, NationStates, season 3" })
    ).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Your cards" })).toBeInTheDocument();
    expect(screen.queryByText(/more cards/)).toBeNull();
    expect(screen.getByRole("button", { name: "Import another nation" })).toBeInTheDocument();
  });

  it("shows the first 12 faces and counts the rest", () => {
    const faces = Array.from({ length: 15 }, (_, i) => face(i + 1));
    render(
      <ImportCompleteStep
        importResult={{ cardsImported: 15, bonusCredits: 150, nation: "Testlandia", faces }}
        onReset={jest.fn()}
      />
    );
    expect(screen.getAllByRole("img", { name: /, Rare, Standard, NationStates/ })).toHaveLength(12);
    expect(screen.getByText("+3 more cards")).toBeInTheDocument();
  });

  it("shows no card list when nothing was imported", () => {
    render(
      <ImportCompleteStep
        importResult={{ cardsImported: 0, bonusCredits: 0, nation: "Testlandia", faces: [] }}
        onReset={jest.fn()}
      />
    );
    expect(screen.queryByRole("list")).toBeNull();
  });
});
