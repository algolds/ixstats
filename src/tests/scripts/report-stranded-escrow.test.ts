/** @jest-environment node */
import { describe, expect, it } from "@jest/globals";
import {
  formatStrandedEscrowReport,
  selectStrandedCompanies,
} from "../../../scripts/exchange/report-stranded-escrow";

describe("report-stranded-escrow", () => {
  it("selects only closed companies with stranded capital, contracts, decisions, or offers and formats amounts in ₷", () => {
    const entries = selectStrandedCompanies({
      companies: [
        {
          id: "c_active",
          name: "Active Works",
          status: "ACTIVE",
          realmId: "default",
          hqCountryId: "na",
          capital: 500_00n,
        },
        {
          id: "c_clean",
          name: "Clean Bankrupt",
          status: "BANKRUPT",
          realmId: "default",
          hqCountryId: "na",
          capital: 0n,
        },
        {
          id: "c_stranded",
          name: "Stranded Co",
          status: "BANKRUPT",
          realmId: "default",
          hqCountryId: "na",
          capital: 125_50n,
        },
      ],
      contracts: [
        {
          id: "ct_awarded",
          title: "Rail Link",
          status: "AWARDED",
          issuerCompanyId: "c_stranded",
          escrow: 300_00n,
        },
        {
          id: "ct_done",
          title: "Old Job",
          status: "COMPLETED",
          issuerCompanyId: "c_stranded",
          escrow: 0n,
        },
      ],
      decisions: [
        {
          id: "dec_1",
          companyId: "c_stranded",
          type: "EXPAND",
          payload: { requestId: "r1", cost: 200 },
        },
      ],
      proposals: [
        {
          id: "prop_1",
          companyId: "c_active",
          payload: { buyerCompanyId: "c_stranded", offerAmount: 450 },
        },
      ],
    });

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      companyId: "c_stranded",
      capitalSovereigns: 125.5,
      totalStrandedSovereigns: 1075.5,
    });

    const report = formatStrandedEscrowReport(entries);
    expect(report).toContain("Stranded Co (c_stranded, BANKRUPT, realm=default, hq=na): total ₷1,075.5");
    expect(report).toContain("capital: ₷125.5");
    expect(report).toContain('contract ct_awarded (AWARDED, "Rail Link"): escrow ₷300');
    expect(report).toContain("pending decision dec_1 (EXPAND): cost ₷200");
    expect(report).toContain("open offer prop_1 -> c_active: ₷450");
  });

  it("reports a clean message when no closed companies hold stranded funds", () => {
    expect(
      formatStrandedEscrowReport(
        selectStrandedCompanies({
          companies: [],
          contracts: [],
          decisions: [],
          proposals: [],
        })
      )
    ).toBe("No closed companies have stranded capital, contracts, pending decisions, or acquisition offers.");
  });
});

