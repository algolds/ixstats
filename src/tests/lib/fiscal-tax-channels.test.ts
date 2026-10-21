import {
  fiscalUpdateForRate,
  readSavedRates,
} from "~/components/mycountry/shell/fiscal/taxChannels";

describe("readSavedRates", () => {
  it("reads the keys the Fiscal Policy tab saves", () => {
    const saved = readSavedRates({
      corporateTaxRates: '{"corporateRate":19}',
      personalIncomeTaxRates: '{"incomeRate":27.5}',
      salesTaxRate: 12,
      exciseTaxRates: '{"tariffRate":6,"capitalGainsRate":18}',
      wealthTaxRate: 0,
    });
    expect(saved.corporate).toEqual({ rate: 19, bracketed: false });
    expect(saved.income).toEqual({ rate: 27.5, bracketed: false });
    expect(saved.vat?.rate).toBe(12);
    expect(saved.tariff?.rate).toBe(6);
    expect(saved.capGains?.rate).toBe(18);
    expect(saved.wealth?.rate).toBe(0);
  });

  it("reads builder brackets as a read-only top rate and plain numeric strings", () => {
    const saved = readSavedRates({
      personalIncomeTaxRates: '[{"bracket":0,"rate":10},{"bracket":50000,"rate":35}]',
      corporateTaxRates: "22",
      exciseTaxRates: '[{"type":"alcohol","rate":20},{"type":"tariff","rate":3}]',
    });
    expect(saved.income).toEqual({ rate: 35, bracketed: true });
    expect(saved.corporate).toEqual({ rate: 22, bracketed: false });
    // An excise list's first entry is not the tariff; only a typed tariff entry counts.
    expect(saved.tariff?.rate).toBe(3);
    expect(saved.capGains?.rate).toBeNull();
  });
});

describe("fiscalUpdateForRate", () => {
  it("writes only the changed tax", () => {
    expect(fiscalUpdateForRate("vat", 14, null)).toEqual({ salesTaxRate: 14 });
    expect(fiscalUpdateForRate("income", 30, null)).toEqual({
      personalIncomeTaxRates: '{"incomeRate":30}',
    });
  });

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
