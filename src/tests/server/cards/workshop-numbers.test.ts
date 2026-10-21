/** @jest-environment node */
/** The numbers card screens preview with: the economy and value configs as stored, and the market fee rate. */
import { CARD_ECONOMY_DEFAULTS, clearEconomyConfigCache } from "~/lib/cards/economy-config";
import { clearGeneralCardSettingsCache } from "~/lib/cards/general-settings";
import { CARD_VALUATION_DEFAULTS, clearValuationCache } from "~/lib/cards/valuation";
import { getPublicEconomyNumbers } from "~/server/modules/cards/workshop/numbers";

const ROWS = [
  { key: "card_economy_dust_rare", value: "60" },
  { key: "card_valuation_floor_common", value: "12" },
  { key: "card_system_auction_rake_pct", value: "7" },
];

beforeEach(() => {
  clearEconomyConfigCache();
  clearValuationCache();
  clearGeneralCardSettingsCache();
});

describe("getPublicEconomyNumbers", () => {
  it("reads the Economy tab, the value numbers and the market fee rate as stored", async () => {
    const db = {
      systemConfig: {
        findMany: jest.fn(async ({ where }: { where: { key: { startsWith: string } } }) =>
          ROWS.filter((r) => r.key.startsWith(where.key.startsWith))
        ),
      },
    };
    expect(await getPublicEconomyNumbers(db as never)).toEqual({
      economy: { ...CARD_ECONOMY_DEFAULTS, dustRare: 60 },
      valuation: { ...CARD_VALUATION_DEFAULTS, floorCommon: 12 },
      feeRatePct: 7,
    });
  });
});
