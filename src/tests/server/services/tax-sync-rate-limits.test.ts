/** @jest-environment node */
/**
 * A tax system save (`taxSystem.create` / `update`) copies its income, corporate and VAT rates into the fiscal system
 * the Fiscal policy console and every revenue figure read. Those rates stay inside the console's channel ranges, so
 * a 100% VAT category cannot put a rate on the console that its own slider could never set.
 */
import { syncTaxData } from "~/server/services/builderIntegrationService";
import { TAX_RATE_LIMITS } from "~/lib/economy/tax-rate-limits";
import type { TaxBuilderState } from "~/types/builder";

it("caps the synced income, corporate and VAT rates at the console's maxima", async () => {
  const update = jest.fn(async () => ({}));
  const existing = { personalIncomeTaxRates: "20", corporateTaxRates: "20", salesTaxRate: 10 };
  const tx = {
    fiscalSystem: { findUnique: jest.fn(async () => existing), update, create: jest.fn() },
  };
  const db = {
    taxSystem: { findUnique: jest.fn(async () => null) },
    fiscalSystem: { findUnique: jest.fn(async () => existing) },
    $transaction: (fn: (t: typeof tx) => Promise<void>) => fn(tx),
  };
  const state = {
    taxSystem: { taxSystemName: "T", progressiveTax: true },
    categories: [
      { categoryName: "Income", categoryType: "Income Tax", baseRate: 100 },
      { categoryName: "Corporate", categoryType: "Corporate Tax", baseRate: 90 },
      { categoryName: "VAT", categoryType: "Value-Added Tax (VAT)", baseRate: 100 },
    ],
    brackets: {},
    exemptions: [],
    deductions: {},
  } as unknown as TaxBuilderState;

  const result = await syncTaxData(db as never, "c1", state);
  expect(result.success).toBe(true);
  expect(update).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({
        personalIncomeTaxRates: String(TAX_RATE_LIMITS.income.max),
        corporateTaxRates: String(TAX_RATE_LIMITS.corporate.max),
        salesTaxRate: TAX_RATE_LIMITS.vat.max,
      }),
    })
  );
});
