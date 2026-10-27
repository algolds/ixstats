/** @jest-environment node */
import { describe, expect, it } from "@jest/globals";
import {
  exciseWithSectorTariff,
  readSectorTariffs,
} from "~/components/mycountry/shell/trade-commerce/sector-tariffs";
import { rateJsonWithin, TAX_RATE_LIMITS } from "~/lib/economy/tax-rate-limits";
import { savedTariffRate } from "~/lib/economy/country-relations";

describe("sector tariffs saved in exciseTaxRates", () => {
  it("round-trips a sector rate in the object form and keeps the overall tariff", () => {
    const raw = exciseWithSectorTariff('{"tariffRate":10,"capitalGainsRate":20}', "mining", 12.5);
    expect(JSON.parse(raw)).toEqual({
      tariffRate: 10,
      capitalGainsRate: 20,
      "sectorTariff:mining": 12.5,
    });
    expect(readSectorTariffs(raw)).toEqual({ mining: 12.5 });
    expect(savedTariffRate(raw)).toBe(10);
  });

  it("starts an object when nothing is saved, and removing a sector clears it", () => {
    const raw = exciseWithSectorTariff(null, "agriculture", 4);
    expect(readSectorTariffs(raw)).toEqual({ agriculture: 4 });
    expect(readSectorTariffs(exciseWithSectorTariff(raw, "agriculture", null))).toEqual({});
  });

  it("uses typed entries when the builder stored an excise list", () => {
    const list = JSON.stringify([
      { type: "tariff", rate: 8 },
      { type: "alcohol", rate: 40 },
    ]);
    const once = exciseWithSectorTariff(list, "services", 3);
    const twice = exciseWithSectorTariff(once, "services", 6);
    expect(JSON.parse(twice)).toEqual([
      { type: "tariff", rate: 8 },
      { type: "alcohol", rate: 40 },
      { type: "sectorTariff:services", rate: 6 },
    ]);
    expect(readSectorTariffs(twice)).toEqual({ services: 6 });
  });

  it("produces JSON the updateFiscalSystem input accepts", () => {
    const raw = exciseWithSectorTariff('{"tariffRate":10}', "manufacturing", 50);
    expect(rateJsonWithin(raw, { tariffRate: TAX_RATE_LIMITS.tariff }, { min: 0, max: 1000 })).toBe(
      true
    );
  });

  it("ignores malformed values", () => {
    expect(readSectorTariffs("not json")).toEqual({});
    expect(readSectorTariffs('{"sectorTariff:x":"abc"}')).toEqual({});
  });
});
