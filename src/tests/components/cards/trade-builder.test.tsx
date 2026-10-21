/**
 * The two-column trade builder: a partner and their trade privacy up front, You give and You get with wishlist marks,
 * the fee and gift notes, and answering, countering or withdrawing an open trade on the same table.
 */
import "react";
import { fireEvent, render, screen } from "@testing-library/react";

jest.mock("~/hooks/cards/useTradeBuilder", () => ({
  usePartnerSearch: jest.fn(),
  useFindPartner: jest.fn(),
  useTradeables: jest.fn(),
  usePartnerWishlist: jest.fn(),
  useTradeDetails: jest.fn(),
  useSeedCopy: jest.fn(),
  useTradeMutations: jest.fn(),
}));
jest.mock("~/hooks/cards/useSheetEconomy", () => ({ useEconomyNumbers: jest.fn() }));
jest.mock("~/hooks/useCardSheet", () => {
  const open = jest.fn();
  return { useCardSheet: () => ({ open }) };
});
jest.mock("~/components/providers/FacetMotionConfig", () => ({
  useFacetReducedMotion: () => true,
}));
jest.mock("~/components/cards/face/CardFace", () => ({
  CardFace: ({
    face,
    onOpen,
  }: {
    face: { title: string };
    onOpen?: (face: { title: string }) => void;
  }) =>
    onOpen ? (
      <button onClick={() => onOpen(face)}>Open {face.title}</button>
    ) : (
      <span>{face.title}</span>
    ),
}));
jest.mock("~/components/cards/inscription/ReportInscriptionButton", () => ({
  ReportInscriptionButton: ({ ownershipId }: { ownershipId: string }) => (
    <button>Report inscription on {ownershipId}</button>
  ),
}));

import {
  useFindPartner,
  usePartnerSearch,
  usePartnerWishlist,
  useSeedCopy,
  useTradeables,
  useTradeDetails,
  useTradeMutations,
} from "~/hooks/cards/useTradeBuilder";
import { useEconomyNumbers } from "~/hooks/cards/useSheetEconomy";
import { CARD_ECONOMY_DEFAULTS } from "~/lib/cards/economy-config";
import { TradeBuilderSheet } from "~/components/cards/trade/TradeBuilderSheet";

const face = (id: string) => ({
  cardId: `card_${id}`,
  title: `Card ${id}`,
  copy: { ownershipId: id, finish: "STANDARD", serialNumber: 1, level: 1 },
});
const tradeable = (id: string, over: object = {}) => ({
  ownershipId: id,
  face: face(id),
  inscription: null,
  value: 100,
  highlighted: false,
  ...over,
});
const privacy = (over: object = {}) => ({
  audience: "everyone",
  allowed: true,
  cardsShown: true,
  ...over,
});
const partner = (over: object = {}) => ({
  id: "bob",
  handle: "bob",
  displayName: "@bob",
  countryName: "Aurelia",
  privacy: privacy(),
  ...over,
});

const mutation = () => ({ mutate: jest.fn(), isPending: false });
let mutations: Record<"create" | "counter" | "respond" | "cancel", ReturnType<typeof mutation>>;

const findsPartner = (data: object | null) =>
  jest.mocked(useFindPartner).mockReturnValue({ data, isFetched: true } as never);
beforeEach(() => {
  jest.clearAllMocks();
  mutations = { create: mutation(), counter: mutation(), respond: mutation(), cancel: mutation() };
  jest.mocked(useTradeMutations).mockReturnValue(mutations as never);
  jest.mocked(useEconomyNumbers).mockReturnValue({
    data: { economy: CARD_ECONOMY_DEFAULTS, feeRatePct: 10 },
  } as never);
  jest.mocked(usePartnerSearch).mockReturnValue({ data: [] } as never);
  findsPartner(partner());
  jest.mocked(useTradeables).mockImplementation(
    (_partner, side) =>
      ({
        data: {
          items:
            side === "mine"
              ? [tradeable("m1", { highlighted: true }), tradeable("m2")]
              : [tradeable("t1", { highlighted: true }), tradeable("t2", { value: 0 })],
          nextCursor: null,
        },
      }) as never
  );
  jest.mocked(usePartnerWishlist).mockReturnValue({
    data: [
      { cardId: "card_m1", title: "Card m1", rarity: "RARE", realmId: "default", youOwn: 1 },
      { cardId: "card_z", title: "Card z", rarity: "EPIC", realmId: "default", youOwn: 0 },
    ],
  } as never);
  jest.mocked(useTradeDetails).mockReturnValue({ data: undefined } as never);
  jest.mocked(useSeedCopy).mockReturnValue(undefined);
});

const renderNew = (seed: object = { partnerHandle: "bob" }) =>
  render(<TradeBuilderSheet open onOpenChange={jest.fn()} seed={seed} />);
describe("TradeBuilderSheet: a new trade", () => {
  it("says what the credits you get cost in fees, and when the table is a gift", () => {
    renderNew();
    fireEvent.click(screen.getByRole("button", { name: "Add Card m2 to You give" }));
    expect(screen.getByText("This is a gift: one side gives nothing back.")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Credits you get"), { target: { value: "300" } });
    expect(screen.queryByText(/gift/)).toBeNull();
    expect(
      screen.getByText("The market fee on the 300 IxC you get is 30 IxC, so you receive 270 IxC.")
    ).toBeTruthy();
  });
});
