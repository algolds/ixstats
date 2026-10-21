import {
  fiscalUpdateForRate
} from "~/components/mycountry/shell/fiscal/taxChannels";
describe("fiscalUpdateForRate", () => {
  it("merges tariff and capital gains into an existing excise object", () => {
    const update = fiscalUpdateForRate("tariff", 7, '{"capitalGainsRate":18}');
    expect(JSON.parse(update.exciseTaxRates!)).toEqual({ capitalGainsRate: 18, tariffRate: 7 });
  });

  it("keeps the builder's excise list and replaces its own entry", () => {
    const update = fiscalUpdateForRate(
      "tariff",
      5,
      '[{"type":"alcohol","rate":20},{"type":"tariff","rate":3}]'
    );
    expect(JSON.parse(update.exciseTaxRates!)).toEqual([
      { type: "alcohol", rate: 20 },
      { type: "tariff", rate: 5 },
    ]);
  });
});
