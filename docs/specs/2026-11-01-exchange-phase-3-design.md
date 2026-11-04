# The Exchange (₷) Phase 3: Dynamic Corporate Simulator, MyCountry Macro Coupling & Facet 4 Architecture

**Last updated:** 2026-11-01 · **Status:** Approved Design Spec (Phase 3, backlog row VT-16). Builds on [2026-10-06-exchange-economy-design.md](2026-10-06-exchange-economy-design.md), [systems/exchange.md](../systems/exchange.md), and [reference/facet-design-system.md](../reference/facet-design-system.md).

---

## 1. Executive Summary & System Vision

The Exchange (`₷` Sovereigns) evolves from a standalone company-and-contract sandbox into IxStates' **flagship corporate and capital-market simulator**, tightly coupled to each Realm's national economies, fiscal policies, trade networks, and executive governance:

1. **Global Wallet, Realm-Scoped Markets:** Players hold a single global `ExchangeWallet` (`₷`), while **Companies**, **Contracts**, **Sector Indices**, **Supply Chains**, and **Nation Treasuries** are scoped per **Realm** (`realmId`, defaulting to `"default"` for Ixnay).
2. **4 Macro Sectors × 12 Sub-Industries with Supply-Chain Synergies:** Companies belong to one of 4 macro sectors (`agriculture`, `industry`, `services`, `government`) and one of 12 specialized sub-industries, with upstream-to-downstream supply-chain multipliers inside each Realm.
3. **Full Tick P&L Operating Engine, Credit Lines & Bankruptcy Lifecycle:** On every 6-hour market tick (`exchange-market`), active companies generate organic operating revenue on productive plant (`decisionValue`), pay operating upkeep, service Central Bank credit-facility interest, and pay corporate taxes to their HQ Nation's `₷` Treasury. Companies that exhaust working capital enter a `DISTRESSED` grace window before `BANKRUPT` liquidation or distressed M&A buyout.
4. **Bidirectional MyCountry & Calculator Integration:**
   - **MyCountry → Exchange:** Saved national tax rates (`FiscalPolicyConsole`), sector tariffs (`TradeCommerceConsole`), diplomatic Free Trade Agreements (`DiplomaticRelation` / `Treaty`), national GDP growth (`effectiveGrowthOf`), sector GDP shares (`parseSectorBreakdown`), inflation, interest rates, and atomic government effectiveness (`AtomicEffectiveness`) directly shape corporate P&L, borrowing costs, cross-border contract duties, and Realm Sector Indices.
   - **Exchange → MyCountry:** Domiciled corporate activity, R&D breakthroughs, and completed B2G tenders feed back into the HQ Nation's GDP projection (`StorytellerEffectType.GDP_LEVEL_ADJUSTMENT`, bounded at `±5%`) and `economicVitality` (`±10` points), surface in a new `/mycountry/economy?tab=corporations` console and `EconomyRail`, link with Directives & National Issues, and trigger urgent alerts in `ExecutiveAgenda`.
5. **Two-Sided Order Book & Shareholder Governance:** Adds limit buy bids (`ShareBuyOrder`) with price-time priority matching against `ShareListing` asks, full financial ratios (EPS, P/E, Book Value, Dividend Yield, Debt-to-Equity, Credit Rating), and pro-rata shareholder voting (`CompanyProposal` / `CompanyVote`) for major actions (`DISSOLVE`, `ISSUE_SHARES`, `ACQUIRE_OFFER`).
6. **100% Facet 4 Compliance:** Multi-tab workspace at `/labs/exchange` paired with the sticky 320px `Inspector` drawer, semantic tokens, proper `data-content` scopes (`data`, `visualization`, `input`, `signal`), and locked into `ZERO_TELL_DIRS` in `src/tests/architecture/facet-zero-dirs.test.ts`.

---

## 2. Audit: MyCountry, Calculators & Stats Integration Matrix

### 2.1 Inbound Coupling (MyCountry & Calculators → Exchange Engine)

| MyCountry / Calculator Source | Code Primitive | Exchange Mechanic Driven |
|---|---|---|
| **Corporate Tax Rate** (`0–50%`) | `readSavedRates(fiscalSystem).corporate` (`src/lib/economy/tax-channels.ts`) | Applied to positive net operating profit per tick and `10%` of net contract margin on completion. Taxed `₷` is credited directly to the HQ Nation's `NationTreasury`. Default when unset: `15%`. |
| **Capital Gains Tax Rate** (`0–40%`) | `readSavedRates(fiscalSystem).capGains` (`src/lib/economy/tax-channels.ts`) | Applied to positive realized capital gains on secondary share sales (`(salePrice - avgCost) × shares`) and `50%` of its rate on dividends paid by companies domiciled in that nation. Credited to HQ `NationTreasury`. Default when unset: `10%`. |
| **Sector Tariffs & Trade Treaties** (`0–50%`) | `readSectorTariffs(fiscalSystem.exciseTaxRates)`, `savedTariffRate`, `DiplomaticRelation.treaties` | When a company with `hqCountryId = A` wins a B2B/B2G contract issued in `Country B` (`A ≠ B`), Country B levies its saved tariff for `contract.sectorKey` (capped at `25%` of contract value) into Country B's `NationTreasury`. **FTA Exemption:** If Countries A and B share an active Trade Agreement treaty, the tariff is `0%`. |
| **Realised GDP Growth & Economic Tier** | `effectiveGrowthOf(country)` (`src/lib/economy/effective-growth.ts`), `Country.economicTier` | Drives the HQ Nation's **Demand Multiplier** ($0.85\times \dots 1.35\times$) on a domiciled company's tick operating yield and determines the Nation Treasury's base market-tick stipend. |
| **Recorded Sector Breakdown** | `parseSectorBreakdown(economicProfile.sectorBreakdown)` (`src/lib/economy/sector-breakdown.ts`) | Weights the Realm's macro fundamentals in `computeSectorIndices` and grants a **Comparative Advantage Bonus** (`+5%` to `+15%` plant productivity) to companies whose macro sector accounts for `≥ 25%` of their HQ Nation's GDP. |
| **Interest Rates & Inflation** | `Country.interestRates`, `Country.inflationRate` (`economyFiguresOf`) | Sets the base borrowing rate for a domiciled company's Central Bank credit line ($\text{rate} = \text{clamp}(\text{HQ interestRate}, 2\%, 20\%) + \text{creditSpread}$). High inflation (`> 8%`) increases tick operating upkeep. |
| **Tax Efficiency & Government Efficiency** | `FiscalSystem.taxEfficiency`, `Country.governmentalEfficiency` | Scales how much of collected corporate/tariff taxes reach `NationTreasury` vs friction loss, and modifies R&D (`RND`) breakthrough odds (`±10%`). |

### 2.2 Outbound Coupling (Exchange Engine → MyCountry & Stats)

| Exchange Activity | Target MyCountry / Stat Surface | Mechanism & Bounds |
|---|---|---|
| **Domiciled Corporate Output, R&D & B2G Delivery** | `StorytellerEffect` (`gdp_level_adjustment`) via `syncLevelEffects` (`src/lib/economy/storyteller-effects.ts`) | On each `exchange-market` tick, computes each country's **Corporate Sector Score** from domiciled active companies' `decisionValue + capital`, applied `RND` breakthroughs, and 30d completed B2G tenders relative to the country's tier benchmark. Syncs a named `gdp_level_adjustment` effect (`description: "Exchange corporate sector vitality"`, bounded to **`[-0.02, +0.05]`** / `-2%` to `+5%` GDP level shift). Uses `~/server/shared/realm-time` (never `~/lib/ixtime`, honoring `platform-real-time.test.ts`). |
| **Corporate Health & Employment** | `Country.economicVitality` (`0–100`) | Adjusts `economicVitality` by **`[-5, +10]`** points based on domiciled companies' solvency (positive operating P&L vs `DISTRESSED`/`BANKRUPT` flagships). |
| **Directives (`intent`) & National Issues** | `/mycountry` Directives & Issues + `Contract` (`B2G`) | Nation owners can click **"Issue B2G Tender from Directive/Issue"** on an active Economic Directive or National Issue, linking `Contract.linkedDirectiveId` / `linkedIssueId`. Completing the linked B2G tender grants `+1` bonus standing to the contractor and records a delivery milestone on the nation's record. |
| **MyCountry Economy Console** | `/mycountry/economy?tab=corporations` (`ECONOMY_TABS`) + `EconomyRail` | Adds a 5th tab **`corporations` ("Corporations")** to `ECONOMY_TABS` (`src/lib/mycountry/routes.ts` & `EconomyDrillDown.tsx`) displaying: Nation `₷` Treasury balance & stipend breakdown, corporate/cap-gains/tariff `₷` receipts, domiciled companies table (with tax rate impact), active B2G tenders, and quick tender creation. `EconomyRail` adds a `CorporateSectorInsights` card. |
| **MyCountry Executive Agenda** | `deriveAgendaItems.ts` (`src/components/mycountry/shell/agenda/`) | Surfaces actionable Exchange items in the nation's agenda: (1) B2G tender with closed bidding window awaiting award (`due-soon`), (2) Awarded B2G tender awaiting delivery confirmation, (3) Domiciled flagship company in `DISTRESSED` status, (4) Nation `₷` Treasury at `≥ 95%` of cap ("Deploy treasury capital into B2G tenders"). |

---

## 3. Sectors, Sub-Industries & Supply-Chain Synergies

### 3.1 Taxonomy (4 Macro Sectors × 12 Sub-Industries)

Every company has both a `sectorKey` (4 macro sectors, matching `SectorIndex`) and a `subIndustryKey` (3 per macro sector):

| Macro Sector (`sectorKey`) | Sub-Industry (`subIndustryKey`) | Label | Base Margin | Capital Intensity (Upkeep) | Upstream Inputs Needed |
|---|---|---|---|---|---|
| **`agriculture`** | `agribusiness` | Agribusiness & Crops | `8%` | Low (`1.5%`) | `logistics`, `chemicals` |
| | `forestry_fisheries` | Forestry & Fisheries | `7%` | Low (`1.2%`) | `logistics` |
| | `biotech_food` | Agri-Biotech & Food Processing | `11%` | Med (`2.5%`) | `agribusiness`, `pharma_biotech` |
| **`industry`** | `energy_mining` | Energy & Resource Extraction | `10%` | High (`3.2%`) | `heavy_manufacturing`, `logistics` |
| | `heavy_manufacturing` | Heavy Manufacturing & Defense | `11%` | High (`3.0%`) | `energy_mining`, `chemicals` |
| | `chemicals` | Chemicals & Advanced Materials | `10%` | Med (`2.5%`) | `energy_mining` |
| **`services`** | `finance_insurance` | Banking, Finance & Insurance | `12%` | Low (`1.8%`) | `software_media`, `civic_utilities` |
| | `logistics` | Global Logistics & Shipping | `9%` | Med (`2.4%`) | `energy_mining`, `heavy_manufacturing` |
| | `software_media` | Technology, Media & Telecom | `14%` | Med (`2.6%`) | `semiconductors_rd`, `finance_insurance` |
| **`government`** | `civic_utilities` | Public Utilities & Grid | `7%` | Low (`1.4%`) | `energy_mining`, `defense_aerospace` |
| | `defense_aerospace` | Defense & Aerospace | `12%` | High (`3.2%`) | `heavy_manufacturing`, `software_media` |
| | `pharma_biotech` | Healthcare & Pharmaceuticals | `13%` | High (`2.8%`) | `chemicals`, `biotech_food` |

### 3.2 Supply-Chain Synergy Multiplier

Within a Realm:
- **Realm Supply Availability (`0.90x .. 1.15x`):** If the Realm has active companies operating in a company's required upstream sub-industries, the company receives `+5%` operating efficiency per satisfied upstream link (up to `+10%`).
- **Direct B2B Contract Synergy (`+5%` bonus):** Completing a B2B contract with an upstream supplier in the last 30 days grants an additional `+5%` supply-chain synergy for the next 30 days.

---

## 4. Corporate P&L Engine, Central Bank Credit & Bankruptcy Lifecycle

### 4.1 Tick Operating P&L (`runCompanyOperations` on `exchange-market` every 6h)

Every active company has productive plant (`decisionValue`, built via `EXPAND` and `RND`) and liquid working `capital`:

1. **Gross Operating Revenue (per 6h tick, 1/4 of daily rate):**
   $$\text{GrossRev} = \text{ProductiveBase} \times \frac{\text{BaseMargin}}{4} \times \text{SectorFactor} \times \text{HQDemandFactor} \times \text{SupplyChainFactor} \times \text{PricingFactor}$$
   where:
   - $\text{ProductiveBase} = \text{decisionValue} + 0.5 \times \min(\text{capital}, 50,000) + 250 \times \max(0, \text{standing})$
   - $\text{SectorFactor} = \text{clamp}(\text{SectorIndex} / 1000, 0.6, 1.8)$
   - $\text{HQDemandFactor} = 1 + 2 \times \text{clamp}(\text{effectiveGrowthOf(hqCountry)}, -0.05, 0.10) + \text{sectorAdvantage}$
   - $\text{PricingFactor}$: `"undercut"` = $0.90\times$ margin (higher contract win bonus), `"balanced"` = $1.00\times$, `"premium"` = $1.15\times$ when `standing >= 5` else $0.85\times$.
2. **Operating Upkeep & Overhead:**
   $$\text{Upkeep} = \text{ProductiveBase} \times \frac{\text{UpkeepRate}}{4} \times (1 + \max(0, \text{HQInflation} - 0.02))$$
3. **Debt Interest Service:**
   $$\text{Interest} = \text{creditDrawn} \times \frac{\text{effectiveBorrowRate}}{365 \times 4}$$
   Interest paid is credited directly to the HQ Nation's `NationTreasury` (or burned if the company has no `hqCountryId`).
4. **Corporate Income Tax:**
   If $\text{PreTaxProfit} = \text{GrossRev} - \text{Upkeep} - \text{Interest} > 0$:
   $$\text{Tax} = \text{PreTaxProfit} \times \text{HQCorporateTaxRate} \quad (\text{credited to HQ } \text{NationTreasury})$$
5. **Net Profit / Loss:**
   $$\text{NetIncome} = \text{PreTaxProfit} - \text{Tax}$$
   `Company.capital` increments (or decrements) by `NetIncome`, and `lastTickRevenue`, `lastTickExpenses`, `lastTickTax`, `lastTickNetIncome` are stored on `Company` so the UI and financial ratios can show exact trailing-24h / annualized P&L!

### 4.2 Central Bank Credit Facility (`borrowCredit` / `repayCredit`)

- **Credit Limit:** A company can borrow up to `50%` of its `decisionValue + 0.25 × contractsWonValue` (capped at `250,000 ₷`), provided its status is `ACTIVE` and its Credit Rating is at least `B`.
- **Borrowing Rate:** HQ Country's saved `interestRates` (default `5.0%` if unset) plus a Credit Rating spread (`AAA`: `+0.5%`, `AA`: `+1.0%`, `A`: `+2.0%`, `BBB`: `+3.5%`, `B`: `+6.0%`, `CCC`: `+10.0%`).
- **Restrictions while `creditDrawn > 0`:**
  - Founder cannot directly withdraw capital (`withdrawFromCompany` refused while `creditDrawn > 0`).
  - Dividends are capped at `50%` of net capital above `creditDrawn`.
  - Dissolution requires `creditDrawn === 0`.

### 4.3 Distress & Bankruptcy Lifecycle (`ACTIVE` → `DISTRESSED` → `BANKRUPT`)

- **Entering `DISTRESSED`:** If a market tick's operating loss + interest causes `capital < 0` (or `capital === 0` while `creditDrawn > 0` and unpaid interest accrues into `creditDrawn`), `Company.status` remains operable or transitions to `DISTRESSED` (`distressedSinceIxTime` set), and the founder + shareholders receive a high-priority notification (and a MyCountry Executive Agenda alert if it's a domestic company).
- **72-Hour Cure Window (3 real days):**
  - The founder can cure distress by depositing capital (`depositToCompany`), repaying credit (`repayCredit`), completing an awarded contract, or issuing emergency primary shares.
  - Any rival company in the same Realm can submit a **Distressed M&A Buyout (`ACQUIRE`)** at a discount (`≥ 50%` of net asset value + assuming/paying off `creditDrawn`).
- **Entering `BANKRUPT`:** If uncured after 72 hours, the `exchange-market` tick transitions the company to `BANKRUPT`:
  - Open share listings/buy orders are cancelled and escrows returned.
  - Productive plant (`decisionValue`) is liquidated at `40¢` on the Sovereign (`0.40 × decisionValue`).
  - Proceeds first pay off `creditDrawn` (to HQ `NationTreasury`), and any remaining `₷` is distributed pro-rata to shareholders.

### 4.4 Financial Ratios & Telemetry (`computeCompanyMetrics`)

Exposed on every company record for the UI and Inspector:
- **Market Cap:** `lastTradePrice × sharesOutstanding` (falls back to `fairValue` if untraded).
- **Book Value (NAV):** `Math.max(0, capital + decisionValue - creditDrawn)`.
- **EPS (Annualized per share):** `(lastTickNetIncome × 4 × 365) / sharesOutstanding`.
- **P/E Ratio:** `sharePrice / EPS` (or `null` when `EPS <= 0`).
- **Dividend Yield:** `trailing30dDividends / marketCap`.
- **Debt-to-Equity (D/E):** `creditDrawn / Math.max(1, capital + decisionValue)`.
- **Credit Rating:** `AAA | AA | A | BBB | B | CCC | D` derived deterministically from `standing`, `D/E ratio`, and `lastTickNetIncome`.

---

## 5. Strategic Decisions, Order Book & Corporate Governance

### 5.1 Complete 6-Decision Suite (`src/lib/exchange/decisions.ts`)

| Type | Cost | Parameters | Effect on Resolution (after 1 real day) |
|---|---|---|---|
| `EXPAND` | `100 .. 1,000,000 ₷` | `{ amount }` | Adds `amount` to `decisionValue` (productive plant). `5%` of cost goes to HQ `NationTreasury`. |
| `ENTER_SECTOR` | `500 ₷` | `{ sectorKey, subIndustryKey? }` | Moves company to `sectorKey` and `subIndustryKey`. |
| `RND` | `250 .. 250,000 ₷` | `{ amount, focus: "efficiency" \| "breakthrough" }` | `"efficiency"`: adds `1.15 × amount` to `decisionValue` + `+1` standing. `"breakthrough"`: deterministic hash roll boosted by HQ `governmentalEfficiency`, yielding `0.6x`, `1.35x`, or `2.1x` `amount` to `decisionValue` + `+1..3` standing. |
| `LOBBY` | `500 ₷` | `{ target: "sector" \| "b2g" \| "tax_relief" }` | `50%` credited to HQ `NationTreasury`. Grants 14-day buff: `"sector"` boosts sector index weight (`+1,000`); `"b2g"` grants `+1` extra standing on B2G completions; `"tax_relief"` reduces effective HQ corporate tax rate on this company by `25%` (relative) for 14 days. |
| `PRICE` | `200 ₷` | `{ strategy: "undercut" \| "balanced" \| "premium" }` | Updates `Company.pricingStrategy`, shifting tick operating margin vs contract competitiveness. |
| `ACQUIRE` | `offerAmount ₷` | `{ targetCompanyId, offerAmount }` | Initiates M&A buyout of a same-realm company (`offerAmount` escrowed from buyer capital). Creates a `CompanyProposal` (`ACQUIRE_OFFER`) on the target company (`> 50%` shareholder vote). On approval, pays off target's `creditDrawn`, distributes net `offerAmount` pro-rata to target shareholders, transfers `80%` of target's `decisionValue` and `50%` of positive `standing` + `contractsWonValue` to buyer, and marks target `DELISTED`. |

### 5.2 Two-Sided Limit Order Book (`ShareListing` Asks + `ShareBuyOrder` Bids)

- **Asks (`ShareListing`):** Primary issues (`sellerUserId = null`, priced at fair value per share) and secondary holder asks (`sellerUserId != null`, shares escrowed from `Shareholding`).
- **Bids (`ShareBuyOrder`):** Any user places a limit buy order for `shares` of an open-trading company at `maxPricePerShare` (`₷` escrowed from wallet via `SHARE_BUY_ESCROW`).
- **Price-Time Matching Engine (`matchCompanyOrders`):**
  - Runs inside `lockCompany(tx, companyId)` with sorted `lockWallet` calls.
  - Crossing orders execute immediately at the **resting order's price**.
  - When a buyer's bid fills at a resting ask price lower than `maxPricePerShare`, the price-improvement difference is immediately refunded from escrow to the buyer's wallet.
  - Secondary sellers pay their HQ Nation's **Capital Gains Tax** (if realized gain `> 0`) into the HQ `NationTreasury`, and receive the net proceeds.
  - Updates `Company.lastTradePrice` and `lastTradeIxTime`.

### 5.3 Shareholder Governance (`CompanyProposal` & `CompanyVote`)

- **Sole Founder Fast-Path:** When the founder owns `100%` (or `> 50%` of `sharesOutstanding` for `DISSOLVE` and `ISSUE_SHARES`), their action executes immediately without waiting for a poll.
- **Diluted Founder / Inbound M&A:**
  - When the founder owns `≤ 50%` of `sharesOutstanding`, calling `dissolveCompany` or `issueShares` creates an `OPEN` `CompanyProposal` (with the founder's shares automatically cast `FOR`).
  - Inbound `ACQUIRE` offers always create an `ACQUIRE_OFFER` `CompanyProposal` on the target company unless the buyer and target share the same sole-owner founder.
  - Shareholders vote (`voteOnProposal`) weighted by their `Shareholding.shares + open listed shares`.
  - As soon as `sharesFor > sharesOutstanding / 2`, the proposal transitions to `PASSED` and executes atomically in that transaction! If `sharesAgainst >= sharesOutstanding / 2` (or 3 real days elapse), it transitions to `REJECTED` / `EXPIRED` and refunds any M&A escrow.

---

## 6. Facet 4 UI/UX Architecture

### 6.1 Strict Facet 4 Standards & Zero-Tell Lock

`src/components/exchange` will be added to `ZERO_TELL_DIRS` in `src/tests/architecture/facet-zero-dirs.test.ts`:
- **No AI-design tells:** Zero eyebrows, zero uppercase labels, zero em dashes (`—` replaced with `·` or `–` for empty cells), zero hex classes, zero raw Tailwind palette steps (`emerald-500`, `slate-400`, etc.), zero `dark:` overrides, zero `backdrop-blur-*` outside `layers.css`, zero `@radix-ui/*` direct imports.
- **Layer Discipline:**
  - Canvas (`facet-canvas` with `data-app="labs"` uranium glass tint on `/labs/exchange`, and `data-app="mycountry"` state gold on `/mycountry/economy?tab=corporations`).
  - Top-level `Card`s are Panes (`facet-pane`); nested `Card`s inside Panes automatically render as Wells (`facet-well`).
  - Content types explicitly set via `<Card content="data">`, `<Card content="visualization">`, `<Card content="input">`, and `<Signal>` banners.
- **Typography & Figures:**
  - `PageHeader` with `<h1>` title.
  - Section headers use `<CardTitle icon={<Icon />}>Sentence case title</CardTitle>`.
  - Key metrics use `<Stat label="Sentence case label" value={...} delta={...} />` (`tabular-nums`).

### 6.2 `/labs/exchange` Multi-Tab Workspace + Sticky `Inspector`

1. **Top Bar & Realm Context:**
   - `PageHeader` with trailing **Realm Switcher** (`Select` scoped to active Realms, defaulting to the viewer's primary nation's realm or Ixnay) and a quick **"Charter company"** / **"Post contract"** trigger.
   - Top KPI strip (`grid-cols-2 lg:grid-cols-4`): Personal Wallet (`₷`), Portfolio Net Worth (`₷` + unrealized P&L), Active Nation Treasury (`₷` + daily stipend + tax inflow), and Selected Realm 30d Market Volume.
2. **Primary Workspace (`Tabs` with 5 views):**
   - **Tab 1 — `overview` ("Market overview"):** Sector index sparkline tiles (`content="visualization"`), Leading Corporations leaderboard (`content="data"` with P/E, Market Cap, Last Price, Credit Rating, HQ Country), and Supply-Chain matrix for the selected Realm.
   - **Tab 2 — `companies` ("My corporations"):** Charter form (Name, Sector, Sub-industry, HQ Country in Realm), company cards with full P&L breakdown (Gross Revenue, Upkeep, Interest, HQ Tax, Net Income), Central Bank credit facility controls (Borrow / Repay), Dividend & Share Issuance controls, and the 6-Decision Strategic Queue (`EXPAND`, `ENTER_SECTOR`, `RND`, `LOBBY`, `PRICE`, `ACQUIRE`).
   - **Tab 3 — `orderbook` ("Share market & order book"):** Two-column Bid / Ask depth table (`content="data"`), limit buy order & secondary sell listing form (`content="input"`), my holdings table (with average cost, unrealized gain, and HQ cap-gains tax preview), and my open orders.
   - **Tab 4 — `contracts` ("Contracts & tenders"):** Open B2B contracts and B2G tenders in the Realm (with cross-border tariff / FTA badge preview for the selected bidding company), contract posting form (Company B2B, Nation Treasury B2G, Personal Wallet B2G, or Realm DM Faucet Tender), and contract lifecycle actions.
   - **Tab 5 — `governance` ("Governance & M&A"):** Active shareholder proposals (`DISSOLVE`, `ISSUE_SHARES`, `ACQUIRE_OFFER`) with vote progress bars, `Vote for` / `Vote against` actions, and recent corporate dividend/decision history.
3. **Trailing Sticky `Inspector` (`320px` at `≥1280px`, `Sheet` below):**
   - Clicking any company in the leaderboard, order book, or portfolio opens it in the `Inspector`: shows fair-value component breakdown, 60-point valuation chart, balance sheet & financial ratios (`Market Cap`, `Book Value`, `EPS`, `P/E`, `D/E`, `Credit Rating`), HQ Country tax & macro modifiers, top shareholders, and quick trade/M&A actions.

### 6.3 MyCountry Economy Integration (`/mycountry/economy?tab=corporations` & `EconomyRail`)

- **`src/lib/mycountry/routes.ts`:** `ECONOMY_TABS = ["report", "budget", "taxes", "trade", "corporations"] as const`.
- **`CorporationsTreasuryConsole.tsx`:**
  - Displays the nation's `NationTreasury` balance, tick stipend rate, and tax inflow breakdown (Corporate Income Tax `₷`, Capital Gains Tax `₷`, Cross-Border Tariff `₷`, Central Bank Interest `₷`).
  - Shows how the nation's current saved tax rates (`FiscalPolicyConsole`) and macro metrics (`effectiveGrowthOf`, `interestRates`, `inflationRate`) rank in competitiveness within the Realm.
  - Lists all companies headquartered (`hqCountryId`) in the nation with their status, capital, plant value, credit rating, and tax contribution.
  - Inline B2G Tender composer funded directly from the Nation Treasury (with optional link to an active Directive or National Issue).
- **`EconomyRail.tsx`:** Adds `CorporateTreasuryInsights` showing Treasury `₷`, domiciled company count, and current Exchange GDP level boost (`+X.XX%`).
- **`deriveAgendaItems.ts`:** Adds `exchangeItems` for B2G tenders ready to award, distressed domestic flagships, and capped treasuries.

---

## 7. Additive Schema Specification (`prisma/schema/exchange.prisma`)

1. **`Company` additions:**
   - `realmId String @default("default")`
   - `hqCountryId String?`
   - `subIndustryKey String @default("software_media")`
   - `pricingStrategy String @default("balanced")`
   - `lobbyBuffType String?`
   - `lobbyBuffUntilIxTime Float?`
   - `creditDrawn Float @default(0)`
   - `creditRating String @default("A")`
   - `lastTradePrice Float?`
   - `lastTradeIxTime Float?`
   - `lastTickRevenue Float @default(0)`
   - `lastTickExpenses Float @default(0)`
   - `lastTickTax Float @default(0)`
   - `lastTickNetIncome Float @default(0)`
   - `distressedSinceIxTime Float?`
   - Replace `@unique` on `name` with `@@unique([realmId, name])`, `@@index([realmId, status])`, `@@index([hqCountryId])`.
2. **`Contract` additions:**
   - `realmId String @default("default")`
   - `linkedDirectiveId String?`
   - `linkedIssueId String?`
   - `tariffRate Float @default(0)`
   - `tariffPaid Float @default(0)`
   - `@@index([realmId, status])`
3. **`SectorIndex`, `SectorIndexHistory`, `SectorPosition` additions:**
   - `realmId String @default("default")`
   - `macroWeight Float @default(0)` (stores the Realm's aggregated national sector GDP share)
   - `@@unique([realmId, sectorKey])` on `SectorIndex`
   - `@@unique([ownerUserId, realmId, sectorKey])` on `SectorPosition`
4. **`NationTreasury` (`exchange_nation_treasuries`):**
   - `id String @id @default(cuid())`
   - `countryId String @unique`
   - `realmId String @default("default")`
   - `balance Float @default(0)`
   - `lifetimeStipend Float @default(0)`
   - `lifetimeTaxEarned Float @default(0)`
   - `lifetimeTariffEarned Float @default(0)`
   - `lifetimeInterestEarned Float @default(0)`
   - `lifetimeSpent Float @default(0)`
   - `corporateGdpShift Float @default(0)`
   - `lastStipendIxTime Float?`
   - `createdAt DateTime @default(now())`
   - `updatedAt DateTime @default(now()) @updatedAt`
5. **`ShareBuyOrder` (`exchange_share_buy_orders`):**
   - `id String @id @default(cuid())`
   - `companyId String`
   - `buyerUserId String`
   - `shares Int`
   - `sharesOrdered Int`
   - `maxPricePerShare Float`
   - `escrow Float`
   - `status String @default("OPEN")`
   - `createdIxTime Float`
   - `idempotencyKey String? @unique`
   - `createdAt DateTime @default(now())`
   - `updatedAt DateTime @default(now()) @updatedAt`
6. **`CompanyProposal` (`exchange_company_proposals`) & `CompanyVote` (`exchange_company_votes`):**
   - `CompanyProposal`: `id`, `companyId`, `proposerUserId`, `type` (`DISSOLVE | ISSUE_SHARES | ACQUIRE_OFFER`), `payload Json`, `status` (`OPEN | PASSED | REJECTED | EXPIRED`), `sharesFor Int @default(0)`, `sharesAgainst Int @default(0)`, `totalEligibleShares Int`, `expiresIxTime Float`, `resolvedIxTime Float?`, `idempotencyKey String? @unique`, `createdAt`.
   - `CompanyVote`: `id`, `proposalId`, `voterUserId`, `support Boolean`, `shares Int`, `createdAt`, `@@unique([proposalId, voterUserId])`.

---

## 8. Phased Implementation Plan

1. **Step 1 — Schema & Test Harness (`prisma/schema/exchange.prisma`, `fake-exchange-db.ts`, `play-as-money.test.ts`):**
   - Add new fields/models to `exchange.prisma`, run `bunx prisma generate`, update `fake-exchange-db.ts` and `play-as-money.test.ts` table list (`nationTreasury`, `shareBuyOrder`, `companyProposal`, `companyVote`).
2. **Step 2 — Core Engine Modules (`src/lib/exchange/`):**
   - `sub-industries.ts` (12 sub-industries, supply-chain matrix, financial ratios & credit rating calculator).
   - `treasury.ts` (`NationTreasury` stipends, fiscal tax/tariff/interest collection, B2G treasury escrow/refund, Realm faucet tenders, and `StorytellerEffect` / Vitality feedback via `~/server/shared/realm-time`).
   - `operations.ts` (Tick P&L engine, Central Bank credit lines `borrowCredit` / `repayCredit`, and `ACTIVE → DISTRESSED → BANKRUPT` lifecycle).
   - `governance.ts` (`CompanyProposal`, `CompanyVote`, auto-pass threshold, and `ACQUIRE` M&A execution).
   - Upgrade `companies.ts`, `contracts.ts`, `shares.ts` (two-sided order book matching), `decisions.ts` (all 6 types), `sectors.ts` (Realm-scoped indices + national macro GDP weighting + `setSectorDmModifier`), and `market.ts` (`runExchangeMarketTick`).
3. **Step 3 — tRPC Routers (`src/server/api/routers/exchange/`):**
   - Update `index.ts`, `markets.ts`, `admin.ts`, and add `governance.ts` / `treasury.ts` sub-routers merged into `exchangeRouter` (respecting the `≤ 700` line ceiling per file).
4. **Step 4 — Facet 4 UI Overhaul (`src/components/exchange/` & `/mycountry/economy`):**
   - Build the 5-tab `/labs/exchange` workspace + sticky `Inspector` (`CompanyInspector.tsx`), Order Book depth view, Governance & M&A view, and Nation Treasury controls.
   - Add `src/components/exchange` to `ZERO_TELL_DIRS` in `src/tests/architecture/facet-zero-dirs.test.ts`.
   - Add `CorporationsTreasuryConsole` to `/mycountry/economy?tab=corporations`, `EconomyRail`, and `deriveAgendaItems`.
5. **Step 5 — Comprehensive Tests & Verification:**
   - Unit & scenario tests for order-book matching, fiscal tax/tariff/FTA coupling, tick P&L & bankruptcy, governance & M&A, Realm isolation, and architecture guards (`typecheck`, `facet-zero-dirs`, `platform-real-time`, `play-as-money`, `audit:arch`).
