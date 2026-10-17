/** /vault/import: a finished import shows the copies it minted as their faces, and Mine refetches to list them. */
import { act, render, screen } from "@testing-library/react";
import type React from "react";

jest.mock("~/trpc/react", () => {
  const utils = { cards: { listMine: { invalidate: jest.fn() } } };
  const mutation = () => ({
    useMutation: jest.fn(() => ({ mutate: jest.fn(), isPending: false })),
  });
  return {
    api: {
      useUtils: () => utils,
      nsImport: {
        requestVerification: mutation(),
        checkVerification: mutation(),
        importDeck: mutation(),
      },
    },
  };
});
jest.mock("~/hooks/useNotify", () => ({ useNotify: () => ({ success: jest.fn() }) }));
jest.mock("~/lib/vault/vault-notifications", () => ({
  vaultNotify: { cardsImported: jest.fn(), error: jest.fn(), nationVerified: jest.fn() },
}));
jest.mock("motion/react", () => {
  const { createElement } = jest.requireActual<typeof import("react")>("react");
  type Still = (props: { children?: React.ReactNode; className?: string }) => React.ReactElement;
  const tags = new Map<string, Still>();
  const motion = new Proxy(
    {},
    {
      get: (_target, tag: string) => {
        const known = tags.get(tag);
        if (known) return known;
        const still: Still = ({ children, className }) =>
          createElement(tag, { className }, children);
        tags.set(tag, still);
        return still;
      },
    }
  );
  return {
    motion,
    AnimatePresence: ({ children }: { children?: React.ReactNode }) => children,
  };
});
jest.mock("~/components/ui/number-flow", () => ({ NumberFlowDisplay: () => null }));

import { api } from "~/trpc/react";
import { VaultImportSection } from "~/components/vault/sections/VaultImportSection";
import type { CardFaceData } from "~/lib/cards/face/types";
import type { MutationOptions } from "~/tests/helpers/fake-mutation";

/** What the section reads from `nsImport.importDeck`'s answer. */
interface ImportDeckAnswer {
  cardsImported: number;
  bonusCredits: number;
  nation: string;
  faces: CardFaceData[];
}

const face: CardFaceData = {
  cardId: "card_ns_42_s3",
  title: "Testlandia",
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
  copy: { ownershipId: "o1", finish: "STANDARD", serialNumber: 1, level: 1 },
};

describe("VaultImportSection", () => {
  let importDeck: MutationOptions<ImportDeckAnswer, { verificationId: string }> = {};

  beforeEach(() => {
    jest.mocked(api.nsImport.importDeck.useMutation).mockImplementation(((
      options: typeof importDeck
    ) => {
      importDeck = options;
      return { mutate: jest.fn(), isPending: false };
    }) as never);
  });

  it("shows the imported copies as their faces and refreshes Mine", () => {
    render(<VaultImportSection />);
    act(() =>
      importDeck.onSuccess?.(
        { cardsImported: 1, bonusCredits: 10, nation: "Testlandia", faces: [face] },
        { verificationId: "ver_1" }
      )
    );

    expect(
      screen.getByRole("img", { name: "Testlandia, Rare, Standard, NationStates, season 3" })
    ).toBeInTheDocument();
    expect(api.useUtils().cards.listMine.invalidate).toHaveBeenCalledTimes(1);
  });
});
