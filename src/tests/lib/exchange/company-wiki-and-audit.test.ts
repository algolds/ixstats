/** @jest-environment node */
/**
 * Exchange Audit & WikiOS Company Sync tests:
 * 1. WikiOS company article parser ({{Infobox company}}, lead summary, history excerpt,
 *    sector/sub-industry auto-matching, HQ nation matching, logo filename extraction).
 * 2. Credit line / fair-value invariant: borrowing from the Central Bank increases both
 *    `capital` and `creditDrawn`, leaving net equity and `fairValue` unchanged rather than
 *    inflating primary share issuance price.
 * 3. Charter cap enforcement: `DISTRESSED` companies count toward `activeCompanyCap`.
 * 4. Secondary listing escrow & `avgCost`: `creditHolding` weights `avgCost` across both
 *    unlisted holding shares and open secondary `ShareListing` escrowed shares.
 * 5. Live `{{BusinessData:<company>:<metric>}}` placeholder resolution from Exchange companies.
 */

jest.mock("~/lib/exchange/notify", () => ({
  notifyExchange: jest.fn(),
  sendExchangeNotices: jest.fn(),
}));
jest.mock("~/lib/exchange/macro", () => ({
  ...jest.requireActual("~/lib/exchange/macro"),
  countryMacroOf: () => ({
    corporateTaxRate: 0.2,
    capGainsTaxRate: 0.1,
    tariffFor: () => 0,
    growth: 0,
    interestRate: 0.05,
    inflation: 0,
    governmentEfficiency: 0.5,
    economicTier: "Developed",
    sectorShares: { agriculture: 0, industry: 0, services: 0, government: 0 },
    hasRecordedSector: false,
  }),
}));

import { computeFairValue, foundCompany } from "~/lib/exchange/companies";
import {
  cleanWikiTextValue,
  extractLogoFilename,
  matchHqCountry,
  matchSectorAndSubIndustry,
  parseCompanyWikiPage,
  toCompanyWikiSlug,
} from "~/lib/exchange/company-wiki";
import { borrowCredit, repayCredit } from "~/lib/exchange/credit";
import { buyShares, cancelListing, listShares } from "~/lib/exchange/shares";
import { invalidateExchangeConfigCache } from "~/lib/vault/exchange-config";
import { invalidateVaultConfigCache } from "~/lib/vault/vault-perks";
import { resolveWikiPlaceholderValues } from "~/server/shared/wiki-placeholders";
import { createFakeExchangeDb } from "~/tests/helpers/fake-exchange-db";

describe("WikiOS company article parser", () => {
  const sampleWikitext = `
{{Infobox company
| name = Vanguard Aerospace Systems
| logo = [[File:Vanguard_Aerospace_Logo.svg|220px]]
| motto = ''Reaching Beyond the Horizon''
| type = Public corporation
| industry = [[Aerospace]] and [[Defense contractor|defense]]
| founded = 14 March 1998<ref>Corporate Registry of Caphiria</ref>
| founder = [[Elena Rostova]]
| headquarters = [[Aurelia]], [[Caphiria]]
| key_people = Elena Rostova (CEO)<br />Marcus Vance (CFO)
| products = Fighter aircraft<br />Orbital launch vehicles<br />Avionics
}}
'''Vanguard Aerospace Systems''' is a [[Caphiria]]n aerospace and defense manufacturer headquartered in Aurelia.<ref>Annual Report 2025</ref>

== History ==
Founded in 1998 following the consolidation of three national aviation bureaus, Vanguard built the first indigenous supersonic interceptor in the region.
`;

  it("extracts infobox metadata, lead summary, history excerpt, logo, and taxonomy", () => {
    const parsed = parseCompanyWikiPage("Vanguard Aerospace Systems", sampleWikitext);

    expect(parsed.wikiSlug).toBe("Vanguard_Aerospace_Systems");
    expect(parsed.companyName).toBe("Vanguard Aerospace Systems");
    expect(extractLogoFilename(parsed.logoRaw)).toBe("Vanguard_Aerospace_Logo.svg");
    expect(parsed.motto).toBe("Reaching Beyond the Horizon");
    expect(parsed.foundedText).toBe("14 March 1998");
    expect(parsed.headquartersText).toBe("Aurelia, Caphiria");
    expect(parsed.keyPeople).toBe("Elena Rostova (CEO), Marcus Vance (CFO)");
    expect(parsed.products).toBe("Fighter aircraft, Orbital launch vehicles, Avionics");
    expect(parsed.summary).toContain("Vanguard Aerospace Systems is a Caphirian aerospace");
    expect(parsed.historyExcerpt).toContain("Founded in 1998 following the consolidation");
    expect(parsed.sectorKey).toBe("government");
    expect(parsed.subIndustryKey).toBe("defense_aerospace");
    expect(parsed.taxonomyMatch).toBe("matched");
  });

  it("matches headquarters text to the corresponding realm country", () => {
    const countries = [
      { id: "c_caph", name: "Caphiria", slug: "caphiria" },
      { id: "c_val", name: "Valoria", slug: "valoria" },
    ];
    expect(matchHqCountry("Aurelia, Caphiria", countries)?.id).toBe("c_caph");
    expect(matchHqCountry("Unknown City", countries)).toBeNull();
  });

  it("maps diverse industry descriptions to the 12 Exchange sub-industries", () => {
    expect(matchSectorAndSubIndustry("Commercial banking & credit").subIndustryKey).toBe(
      "finance_insurance"
    );
    expect(matchSectorAndSubIndustry("Maritime container shipping & ports").subIndustryKey).toBe(
      "logistics"
    );
    expect(matchSectorAndSubIndustry("Pharmaceuticals and clinical biotech").subIndustryKey).toBe(
      "pharma_biotech"
    );
    expect(matchSectorAndSubIndustry("Petroleum refining and mining").subIndustryKey).toBe(
      "energy_mining"
    );
  });

  it("normalizes wiki titles and URLs into canonical slugs", () => {
    expect(toCompanyWikiSlug("https://ixwiki.com/wiki/Northgate_Holdings#History")).toBe(
      "Northgate_Holdings"
    );
    expect(toCompanyWikiSlug("File:Logo.png")).toBeNull();
    expect(cleanWikiTextValue("'''Bold''' and [[Target|Label]]<ref>note</ref>")).toBe(
      "Bold and Label"
    );
  });
});

describe("Exchange financial & state invariants", () => {
  beforeEach(() => {
    invalidateExchangeConfigCache();
    invalidateVaultConfigCache();
  });

  it("does not inflate fairValue when borrowing from or repaying a Central Bank credit line", async () => {
    const fake = createFakeExchangeDb({
      user: [{ id: "alice", clerkUserId: "c_alice" }],
      exchangeWallet: [{ id: "w_alice", userId: "alice", sovereigns: 5000_00n }],
      country: [{ id: "nation_a", realmId: "default", economicTier: "Developed" }],
      nationTreasury: [{ id: "t_a", countryId: "nation_a", realmId: "default", balance: 50_000_00n }],
      company: [
        {
          id: "co1",
          name: "Apex Corp",
          realmId: "default",
          founderId: "alice",
          sectorKey: "services",
          subIndustryKey: "software_media",
          hqCountryId: "nation_a",
          capital: 1000_00n,
          standing: 2,
          decisionValue: 10_000_00n,
          creditDrawn: 0n,
          creditRating: "A",
          contractsWonValue: 0n,
          fairValue: 11_200_00n,
          status: "ACTIVE",
        },
      ],
    });

    const initialBreakdown = computeFairValue({
      capital: 1000,
      creditDrawn: 0,
      contractsWonValue: 0,
      standing: 2,
      decisionValue: 10_000,
    });
    expect(initialBreakdown.fairValue).toBe(11_200);

    await borrowCredit(fake.client, {
      userId: "alice",
      companyId: "co1",
      amount: 3000,
      requestId: "req_borrow_1",
    });

    const afterBorrow = fake.tables.company!.find((c) => c.id === "co1")!;
    expect(afterBorrow.capital).toBe(4000_00n);
    expect(afterBorrow.creditDrawn).toBe(3000_00n);
    // Net liquid capital is still 4000 - 3000 = 1000, so fairValue remains 11,200
    expect(afterBorrow.fairValue).toBe(11_200_00n);

    await repayCredit(fake.client, {
      userId: "alice",
      companyId: "co1",
      amount: 1500,
      requestId: "req_repay_1",
    });

    const afterRepay = fake.tables.company!.find((c) => c.id === "co1")!;
    expect(afterRepay.capital).toBe(2500_00n);
    expect(afterRepay.creditDrawn).toBe(1500_00n);
    expect(afterRepay.fairValue).toBe(11_200_00n);
  });

  it("counts DISTRESSED companies toward activeCompanyCap when chartering", async () => {
    const fake = createFakeExchangeDb({
      user: [{ id: "alice", clerkUserId: "c_alice" }],
      exchangeWallet: [{ id: "w_alice", userId: "alice", sovereigns: 50_000_00n }],
      systemConfig: [{ key: "exchange_active_company_cap", value: "2" }],
      company: [
        {
          id: "co1",
          name: "First Co",
          realmId: "default",
          founderId: "alice",
          sectorKey: "services",
          status: "ACTIVE",
        },
        {
          id: "co2",
          name: "Second Co",
          realmId: "default",
          founderId: "alice",
          sectorKey: "services",
          status: "DISTRESSED",
        },
      ],
    });

    await expect(
      foundCompany(fake.client, {
        userId: "alice",
        name: "Third Co",
        sectorKey: "services",
        requestId: "req_charter_3",
      })
    ).rejects.toMatchObject({ code: "LIMIT_REACHED" });
  });

  it("preserves true weighted avgCost when a shareholder has shares escrowed in an open listing", async () => {
    const fake = createFakeExchangeDb({
      user: [
        { id: "alice", clerkUserId: "c_alice" },
        { id: "bob", clerkUserId: "c_bob" },
      ],
      exchangeWallet: [
        { id: "w_alice", userId: "alice", sovereigns: 10_000_00n },
        { id: "w_bob", userId: "bob", sovereigns: 10_000_00n },
      ],
      company: [
        {
          id: "co1",
          name: "Apex",
          realmId: "default",
          founderId: "bob",
          sectorKey: "services",
          status: "ACTIVE",
          tradingOpen: true,
          sharesIssued: 1000,
          sharesOutstanding: 1000,
          fairValue: 10_000_00n,
        },
      ],
      shareholding: [
        { id: "sh_alice", companyId: "co1", ownerUserId: "alice", shares: 500, avgCost: 10 },
        { id: "sh_bob", companyId: "co1", ownerUserId: "bob", shares: 500, avgCost: 10 },
      ],
    });

    // Alice lists all 500 of her shares at 30 ₷ (escrowing them out of holding.shares)
    const { listing: aliceListing } = await listShares(fake.client, {
      userId: "alice",
      companyId: "co1",
      shares: 500,
      pricePerShare: 30,
      requestId: "req_list_alice",
    });

    // Bob lists 100 shares at 20 ₷, and Alice buys them
    const { listing: bobListing } = await listShares(fake.client, {
      userId: "bob",
      companyId: "co1",
      shares: 100,
      pricePerShare: 20,
      requestId: "req_list_bob",
    });
    await buyShares(fake.client, {
      userId: "alice",
      listingId: bobListing.id,
      shares: 100,
      requestId: "req_buy_alice",
    });

    // Alice cancels her listing of 500 shares; her total 600 shares should have avgCost = (500*10 + 100*20)/600 = 11.67
    await cancelListing(fake.client, { userId: "alice", listingId: aliceListing.id });
    const aliceHolding = fake.tables.shareholding!.find((h) => h.ownerUserId === "alice")!;
    expect(aliceHolding.shares).toBe(600);
    expect(aliceHolding.avgCost).toBeCloseTo(11.67, 2);
  });
});

describe("Live {{BusinessData}} placeholder bridge for Exchange companies", () => {
  it("resolves live financial metrics from Exchange companies by name or wikiSlug", async () => {
    const mockDb = {
      company: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: "co_vanguard",
            name: "Vanguard Aerospace",
            wikiSlug: "Vanguard_Aerospace_Systems",
            wikiData: { foundedText: "1998" },
            sectorKey: "government",
            subIndustryKey: "defense_aerospace",
            hqCountryId: "c_caph",
            capital: 25_000_00n,
            standing: 4.5,
            fairValue: 80_000_00n,
            sharesOutstanding: 1000,
            decisionValue: 40_000_00n,
            contractsWonValue: 0n,
            creditDrawn: 5000_00n,
            creditRating: "AA",
            lastTradePrice: 85_00n,
            lastTickRevenue: 1200_00n,
            lastTickExpenses: 0n,
            lastTickTax: 0n,
            lastTickNetIncome: 450_00n,
            status: "ACTIVE",
          },
        ]),
      },
      country: {
        findMany: jest.fn().mockResolvedValue([
          { id: "c_caph", name: "Caphiria", realmId: "default" },
        ]),
      },
      pointOfInterest: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    const results = await resolveWikiPlaceholderValues(
      [
        "BusinessData:Vanguard_Aerospace:revenue",
        "BusinessData:Vanguard_Aerospace:fair_value",
        "BusinessData:Vanguard_Aerospace:market_cap",
        "BusinessData:Vanguard_Aerospace:credit_rating",
        "BusinessData:Vanguard_Aerospace_Systems:industry",
        "BusinessData:Vanguard_Aerospace_Systems:founded",
      ],
      mockDb
    );

    expect(results.map((r) => [r.key, r.status, r.value])).toEqual([
      ["BusinessData:Vanguard_Aerospace:revenue", "resolved", "₷1,200"],
      ["BusinessData:Vanguard_Aerospace:fair_value", "resolved", "₷80,000"],
      ["BusinessData:Vanguard_Aerospace:market_cap", "resolved", "₷85,000"],
      ["BusinessData:Vanguard_Aerospace:credit_rating", "resolved", "AA"],
      ["BusinessData:Vanguard_Aerospace_Systems:industry", "resolved", "Defense & Aerospace"],
      ["BusinessData:Vanguard_Aerospace_Systems:founded", "resolved", "1998"],
    ]);
  });
});
