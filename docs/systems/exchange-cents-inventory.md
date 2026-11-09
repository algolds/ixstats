# Exchange Integer Cents Migration Inventory (Plan 446 — Temporary)

> Temporary Phase A inventory for Plan 446. Deleted in Phase B after full migration.

---

## 1. Schema Columns (`prisma/schema/exchange.prisma`)

All 58 `Float` columns across the 26 models in `prisma/schema/exchange.prisma`, classified as **Money** (`BigInt` cents) or **Not money** (remains `Float`). Models with no `Float` columns (`CompanyVote`, `ExchangeWatch`) are omitted from the column table and listed in the delegate reader/writer section.

| Model | Table (`@@map`) | Field | Current Type & Default | Target Type & Default | Classification | Reason |
|---|---|---|---|---|---|---|
| `ExchangeWallet` | `exchange_wallets` | `sovereigns` | `Float @default(0)` | `BigInt @default(0)` | **Money** | Wallet ₷ balance stored in integer cents. |
| `ExchangeWallet` | `exchange_wallets` | `lifetimeEarned` | `Float @default(0)` | `BigInt @default(0)` | **Money** | Cumulative ₷ credited to wallet in cents. |
| `ExchangeWallet` | `exchange_wallets` | `lifetimeSpent` | `Float @default(0)` | `BigInt @default(0)` | **Money** | Cumulative ₷ debited from wallet in cents. |
| `ExchangeTransaction` | `exchange_transactions` | `sovereigns` | `Float` | `BigInt` | **Money** | Signed ₷ ledger delta in cents. |
| `ExchangeTransaction` | `exchange_transactions` | `balanceAfter` | `Float` | `BigInt` | **Money** | Wallet ₷ balance after the ledger move in cents. |
| `ExchangeTransaction` | `exchange_transactions` | `ixTime` | `Float` | `Float` | **Not money** | Epoch-ms timestamp when transaction occurred. |
| `Company` | `exchange_companies` | `capital` | `Float @default(0)` | `BigInt @default(0)` | **Money** | Corporate liquid cash ₷ balance in cents. |
| `Company` | `exchange_companies` | `standing` | `Float @default(0)` | `Float @default(0)` | **Not money** | Reputation score from contract performance. |
| `Company` | `exchange_companies` | `fairValue` | `Float @default(0)` | `BigInt @default(0)` | **Money** | Sim-computed company valuation in cents. |
| `Company` | `exchange_companies` | `contractsWonValue` | `Float @default(0)` | `BigInt @default(0)` | **Money** | Cumulative ₷ face value of completed contracts won. |
| `Company` | `exchange_companies` | `decisionValue` | `Float @default(0)` | `BigInt @default(0)` | **Money** | Productive plant ₷ value added by EXPAND/R&D decisions. |
| `Company` | `exchange_companies` | `lobbyBuffUntilIxTime` | `Float?` | `Float?` | **Not money** | Epoch-ms timestamp when lobby tax buff expires. |
| `Company` | `exchange_companies` | `creditDrawn` | `Float @default(0)` | `BigInt @default(0)` | **Money** | ₷ principal + capitalized interest owed to HQ treasury. |
| `Company` | `exchange_companies` | `lastTradePrice` | `Float?` | `BigInt?` | **Money** | Most recent secondary share trade price per share in cents. |
| `Company` | `exchange_companies` | `lastTradeIxTime` | `Float?` | `Float?` | **Not money** | Epoch-ms timestamp of last share trade. |
| `Company` | `exchange_companies` | `lastTickRevenue` | `Float @default(0)` | `BigInt @default(0)` | **Money** | Last operating tick gross revenue in cents. |
| `Company` | `exchange_companies` | `lastTickExpenses` | `Float @default(0)` | `BigInt @default(0)` | **Money** | Last operating tick upkeep + interest expenses in cents. |
| `Company` | `exchange_companies` | `lastTickTax` | `Float @default(0)` | `BigInt @default(0)` | **Money** | Last operating tick corporate tax paid in cents. |
| `Company` | `exchange_companies` | `lastTickNetIncome` | `Float @default(0)` | `BigInt @default(0)` | **Money** | Signed last operating tick net income in cents. |
| `Company` | `exchange_companies` | `distressedSinceIxTime` | `Float?` | `Float?` | **Not money** | Epoch-ms timestamp when distress window started. |
| `Company` | `exchange_companies` | `createdIxTime` | `Float` | `Float` | **Not money** | Epoch-ms timestamp when company was chartered. |
| `CompanyValueHistory` | `exchange_company_value_history` | `fairValue` | `Float` | `BigInt` | **Money** | Historical company fair value snapshot in cents. |
| `CompanyValueHistory` | `exchange_company_value_history` | `recordedIxTime` | `Float` | `Float` | **Not money** | Epoch-ms timestamp of valuation snapshot. |
| `ShareIssuance` | `exchange_share_issuances` | `pricePerShare` | `Float` | `BigInt` | **Money** | Primary issuance price per share in cents. |
| `ShareIssuance` | `exchange_share_issuances` | `issuedIxTime` | `Float` | `Float` | **Not money** | Epoch-ms timestamp when shares were issued. |
| `ShareListing` | `exchange_share_listings` | `pricePerShare` | `Float` | `BigInt` | **Money** | Ask price per share in cents. |
| `ShareListing` | `exchange_share_listings` | `createdIxTime` | `Float` | `Float` | **Not money** | Epoch-ms timestamp when listing was opened. |
| `CompanyDividend` | `exchange_company_dividends` | `declared` | `Float` | `BigInt` | **Money** | Total ₷ dividend declared by company in cents. |
| `CompanyDividend` | `exchange_company_dividends` | `amount` | `Float` | `BigInt` | **Money** | Actual ₷ dividend paid out (declared minus sub-cent remainder) in cents. |
| `CompanyDividend` | `exchange_company_dividends` | `ixTime` | `Float` | `Float` | **Not money** | Epoch-ms timestamp when dividend was paid. |
| `Shareholding` | `exchange_shareholdings` | `avgCost` | `Float @default(0)` | `BigInt @default(0)` | **Money** | Weighted average acquisition cost per share in cents. |
| `SectorIndex` | `exchange_sector_indices` | `value` | `Float @default(1000)` | `Float @default(1000)` | **Not money** | Dimensionless sector index level (base 1000). |
| `SectorIndex` | `exchange_sector_indices` | `baseTotal` | `Float?` | `Float?` | **Not money** | Epoch reference activity score for index ratio. |
| `SectorIndex` | `exchange_sector_indices` | `dmModifier` | `Float @default(0)` | `Float @default(0)` | **Not money** | DM multiplier fraction (-0.5..2.0). |
| `SectorIndex` | `exchange_sector_indices` | `macroWeight` | `Float @default(0)` | `Float @default(0)` | **Not money** | Sector share of realm GDP (0..1 fraction). |
| `SectorIndex` | `exchange_sector_indices` | `computedIxTime` | `Float?` | `Float?` | **Not money** | Epoch-ms timestamp of last index computation. |
| `SectorIndex` | `exchange_sector_indices` | `fundSovereigns` | `Float @default(0)` | `BigInt @default(0)` | **Money** | ₷ pooled in the sector index fund in cents. |
| `SectorIndex` | `exchange_sector_indices` | `unitsOutstanding` | `Float @default(0)` | `Float @default(0)` | **Not money** | Fractional fund units held by investors. |
| `SectorIndexHistory` | `exchange_sector_index_history` | `value` | `Float` | `Float` | **Not money** | Dimensionless historical sector index level. |
| `SectorIndexHistory` | `exchange_sector_index_history` | `recordedIxTime` | `Float` | `Float` | **Not money** | Epoch-ms timestamp of index snapshot. |
| `SectorPosition` | `exchange_sector_positions` | `units` | `Float @default(0)` | `Float @default(0)` | **Not money** | Fractional fund units held by investor. |
| `SectorPosition` | `exchange_sector_positions` | `avgCost` | `Float @default(0)` | `BigInt @default(0)` | **Money** | Weighted average cost per unit in cents. |
| `ConversionLog` | `exchange_conversion_logs` | `ixCredits` | `Float` | `Float` | **Not money** | IxCredits amount (different currency; out of scope). |
| `ConversionLog` | `exchange_conversion_logs` | `sovereigns` | `Float` | `BigInt` | **Money** | ₷ converted in cents. |
| `ConversionLog` | `exchange_conversion_logs` | `rate` | `Float` | `Float` | **Not money** | Exchange conversion rate ratio. |
| `ConversionLog` | `exchange_conversion_logs` | `fee` | `Float` | `BigInt` | **Money** | ₷ conversion fee in cents. |
| `ConversionLog` | `exchange_conversion_logs` | `ixTime` | `Float` | `Float` | **Not money** | Epoch-ms timestamp of conversion. |
| `CompanyDecision` | `exchange_company_decisions` | `submittedIxTime` | `Float` | `Float` | **Not money** | Epoch-ms timestamp when decision was queued. |
| `CompanyDecision` | `exchange_company_decisions` | `appliedIxTime` | `Float?` | `Float?` | **Not money** | Epoch-ms timestamp when decision was applied. |
| `Contract` | `exchange_contracts` | `value` | `Float` | `BigInt` | **Money** | Contract face ₷ payout value in cents. |
| `Contract` | `exchange_contracts` | `endIxTime` | `Float` | `Float` | **Not money** | Epoch-ms timestamp when bidding closes. |
| `Contract` | `exchange_contracts` | `escrow` | `Float @default(0)` | `BigInt @default(0)` | **Money** | ₷ held in escrow for the contract in cents. |
| `Contract` | `exchange_contracts` | `tariffRate` | `Float @default(0)` | `Float @default(0)` | **Not money** | Cross-border tariff rate fraction (0..0.25). |
| `Contract` | `exchange_contracts` | `tariffPaid` | `Float @default(0)` | `BigInt @default(0)` | **Money** | ₷ tariff paid to issuer nation treasury in cents. |
| `Contract` | `exchange_contracts` | `createdIxTime` | `Float` | `Float` | **Not money** | Epoch-ms timestamp when contract was created. |
| `Contract` | `exchange_contracts` | `closedIxTime` | `Float?` | `Float?` | **Not money** | Epoch-ms timestamp when contract settled/expired. |
| `ContractBid` | `exchange_contract_bids` | `amount` | `Float` | `BigInt` | **Money** | Bid ₷ amount in cents. |
| `ContractBid` | `exchange_contract_bids` | `standingDelta` | `Float @default(0)` | `Float @default(0)` | **Not money** | Reputation score delta from contract outcome. |
| `ContractBid` | `exchange_contract_bids` | `createdIxTime` | `Float` | `Float` | **Not money** | Epoch-ms timestamp when bid was placed. |
| `NationTreasury` | `exchange_nation_treasuries` | `balance` | `Float @default(0)` | `BigInt @default(0)` | **Money** | Nation treasury liquid ₷ balance in cents. |
| `NationTreasury` | `exchange_nation_treasuries` | `lifetimeStipend` | `Float @default(0)` | `BigInt @default(0)` | **Money** | Cumulative ₷ stipend minted to treasury in cents. |
| `NationTreasury` | `exchange_nation_treasuries` | `lifetimeTaxEarned` | `Float @default(0)` | `BigInt @default(0)` | **Money** | Cumulative corporate & cap-gains ₷ tax earned in cents. |
| `NationTreasury` | `exchange_nation_treasuries` | `lifetimeTariffEarned` | `Float @default(0)` | `BigInt @default(0)` | **Money** | Cumulative cross-border ₷ tariff earned in cents. |
| `NationTreasury` | `exchange_nation_treasuries` | `lifetimeInterestEarned` | `Float @default(0)` | `BigInt @default(0)` | **Money** | Cumulative credit-line ₷ interest earned in cents. |
| `NationTreasury` | `exchange_nation_treasuries` | `lifetimeSpent` | `Float @default(0)` | `BigInt @default(0)` | **Money** | Cumulative ₷ spent by treasury in cents. |
| `NationTreasury` | `exchange_nation_treasuries` | `corporateGdpShift` | `Float @default(0)` | `Float @default(0)` | **Not money** | Bounded GDP level fraction (-0.05..0.05) from corporate sector (`feedback.ts`). |
| `NationTreasury` | `exchange_nation_treasuries` | `lastStipendIxTime` | `Float?` | `Float?` | **Not money** | Epoch-ms timestamp of last stipend tick. |
| `NationTreasury` | `exchange_nation_treasuries` | `lendingSpread` | `Float @default(0)` | `Float @default(0)` | **Not money** | Central bank interest rate spread fraction (-0.02..0.10). |
| `NationTreasury` | `exchange_nation_treasuries` | `companyCreditCap` | `Float @default(250000)` | `BigInt @default(25000000)` | **Money** | Max ₷ a domestic company may borrow in cents (₷250,000 = 25,000,000¢). |
| `NationTreasuryEntry` | `exchange_nation_treasury_entries` | `amount` | `Float` | `BigInt` | **Money** | Signed ₷ treasury ledger move in cents. |
| `NationTreasuryEntry` | `exchange_nation_treasury_entries` | `balanceAfter` | `Float` | `BigInt` | **Money** | Nation treasury ₷ balance after move in cents. |
| `NationTreasuryEntry` | `exchange_nation_treasury_entries` | `ixTime` | `Float` | `Float` | **Not money** | Epoch-ms timestamp of treasury ledger entry. |
| `ShareBuyOrder` | `exchange_share_buy_orders` | `maxPricePerShare` | `Float` | `BigInt` | **Money** | Limit bid price per share in cents. |
| `ShareBuyOrder` | `exchange_share_buy_orders` | `escrow` | `Float` | `BigInt` | **Money** | Remaining ₷ escrowed for open buy order in cents. |
| `ShareBuyOrder` | `exchange_share_buy_orders` | `createdIxTime` | `Float` | `Float` | **Not money** | Epoch-ms timestamp when buy order was placed. |
| `CompanyProposal` | `exchange_company_proposals` | `expiresIxTime` | `Float` | `Float` | **Not money** | Epoch-ms timestamp when shareholder vote expires. |
| `CompanyProposal` | `exchange_company_proposals` | `resolvedIxTime` | `Float?` | `Float?` | **Not money** | Epoch-ms timestamp when shareholder vote resolved. |
| `NationBond` | `exchange_nation_bonds` | `faceValue` | `Float @default(100)` | `BigInt @default(10000)` | **Money** | Bond unit face value in cents (₷100 = 10,000¢). |
| `NationBond` | `exchange_nation_bonds` | `couponRate` | `Float` | `Float` | **Not money** | Annual coupon rate fraction (0.005..0.25). |
| `NationBond` | `exchange_nation_bonds` | `lastTradePrice` | `Float?` | `BigInt?` | **Money** | Last secondary trade price per bond unit in cents. |
| `BondHolding` | `exchange_bond_holdings` | `avgCost` | `Float @default(0)` | `BigInt @default(0)` | **Money** | Weighted average acquisition cost per bond unit in cents. |
| `BondListing` | `exchange_bond_listings` | `pricePerUnit` | `Float` | `BigInt` | **Money** | Secondary listing ask price per bond unit in cents. |
| `ExchangeNewsItem` | `exchange_news_items` | `movePct` | `Float?` | `Float?` | **Not money** | Percentage move figure for market news item. |
| `ExchangeNationSnapshot` | `exchange_nation_snapshots` | `corporateTaxRate` | `Float` | `Float` | **Not money** | Nation corporate tax rate fraction. |
| `ExchangeNationSnapshot` | `exchange_nation_snapshots` | `capGainsTaxRate` | `Float` | `Float` | **Not money** | Nation capital gains tax rate fraction. |
| `ExchangeNationSnapshot` | `exchange_nation_snapshots` | `interestRate` | `Float` | `Float` | **Not money** | Nation central bank interest rate fraction. |

**Totals**: 58 `Float` columns → **32 Money columns (`BigInt`)** + **26 Non-money columns (`Float`)**.

---

## 2. Non-Schema ₷ Values (Config Keys, Constants, JSON Payloads)

### A. SystemConfig Keys (`src/lib/vault/exchange-config.ts`)
Stored in `systemConfig` as ₷ strings/numbers; converted once on read via `getExchangeConfig`:

| Config Field | `systemConfig.key` | Default (₷) | Default (Cents) | Classification |
|---|---|---|---|---|
| `charterFee` | `exchange_charter_fee` | `100` | `10_000` | **Money** (fee to charter a company) |
| `seedSovereigns` | `exchange_seed_sovereigns` | `1_000` | `100_000` | **Money** (starter wallet balance) |
| `treasuryDailyStipend` | `exchange_treasury_daily_stipend` | `250` | `25_000` | **Money** (daily base stipend for a Developed nation) |
| `treasuryCap` | `exchange_treasury_cap` | `50_000` | `5_000_000` | **Money** (max treasury balance before stipend stops) |
| `realmWeeklyFaucetCap` | `exchange_realm_weekly_faucet_cap` | `100_000` | `10_000_000` | **Money** (weekly DM contract faucet cap per realm) |
| `realmOperatingBudget` | `exchange_realm_operating_budget` | `20_000` | `2_000_000` | **Money** (6-hour operating revenue pool per realm) |
| `enabled` | `exchange_enabled` | `true` | — | **Not money** (boolean toggle) |
| `maintenanceMode` | `exchange_maintenance_mode` | `false` | — | **Not money** (boolean toggle) |
| `activeCompanyCap` | `exchange_active_company_cap` | `3` | — | **Not money** (count limit) |
| `listingLimitPerUser` | `exchange_listing_limit_per_user` | `10` | — | **Not money** (count limit) |
| `indexTickMinutes` | `exchange_index_tick_minutes` | `60` | — | **Not money** (duration in minutes) |
| `maxOpenRealmContracts` | `exchange_max_open_realm_contracts` | `10` | — | **Not money** (count limit) |

### B. Domain Constants (`src/lib/exchange/*.ts`)

| File | Constant | Current Value (₷) | Cents Equivalent | Notes |
|---|---|---|---|---|
| `src/lib/exchange/bonds.ts` | `BOND_FACE` → `BOND_FACE_CENTS` | `100` | `10_000` | Bond face value per unit |
| `src/lib/exchange/decisions.ts` | `ENTER_SECTOR_COST` | `250` | `25_000` | Cost of `ENTER_SECTOR` decision |
| `src/lib/exchange/decisions.ts` | `EXPAND_MIN` / `EXPAND_MAX` | `100` / `50_000` | `10_000` / `5_000_000` | Bounds for `EXPAND` decision |
| `src/lib/exchange/decisions.ts` | `RND_MIN` / `RND_MAX` | `100` / `50_000` | `10_000` / `5_000_000` | Bounds for `RND` decision |
| `src/lib/exchange/decisions.ts` | `LOBBY_COST` | `300` | `30_000` | Cost of `LOBBY` decision |
| `src/lib/exchange/decisions.ts` | `PRICE_COST` | `50` | `5_000` | Cost of `PRICE` decision |
| `src/lib/exchange/decisions.ts` | `ACQUIRE_MIN` / `ACQUIRE_MAX` | `100` / `10_000_000` | `10_000` / `1_000_000_000` | Bounds for `ACQUIRE` offer |
| `src/lib/exchange/lending.ts` | `COMPANY_CREDIT_CAP_MAX` | `10_000_000` | `1_000_000_000` | Max nation credit cap setting |
| `src/lib/exchange/lending.ts` | `CREDIT_LIMIT_CAP` | `500_000` | `50_000_000` | Hard ceiling on single company credit limit |
| `src/lib/exchange/operations.ts` | `CAPITAL_BASE_CAP` | `50_000` | `5_000_000` | Productive capital cap in operating P&L |
| `src/lib/exchange/sectors.ts` | `ACTIVITY_FLOOR` | `500` | `50_000` | Per-company minimum activity in sector score |
| `src/lib/exchange/feedback.ts` | `BASE_BENCHMARK` | `20_000` | `2_000_000` | Per-nation corporate value benchmark for GDP shift |
| `src/lib/exchange/news.ts` | `LARGE_TRADE_SOVEREIGNS` | `5_000` | `500_000` | Threshold for publishing a large-trade news item |

### C. JSON Columns Holding Money Values
- `CompanyValueHistory.breakdown`: `{ capital, creditDrawn, contractsWonValue, standing, standingMultiplier, decisionValue, fairValue }`
- `CompanyDecision.payload` / `effect`: `{ cost, amount, offerAmount, decisionValueDelta, fairValue, refunded, ... }`
- `CompanyProposal.payload`: `{ amount }` (for `DIVIDEND`), `{ offerAmount, escrow, ... }` (for `ACQUIRE_OFFER`)
- `ExchangeTransaction.metadata`: `{ pricePerShare, gross, tax, fee, ... }`

---

## 3. Delegate Readers & Writers (`grep -rln "\.<delegate>\." src scripts`)

- **`exchangeWallet`**:
  - `src/lib/vault/exchange-service.ts`
  - `src/lib/exchange/fund.ts`
  - `src/lib/exchange/terminal.ts`
  - `src/tests/helpers/sports-world.ts`
  - `src/tests/scenarios/engines/{sports-season,sports-league-moves,sports-transfer-escrow}.test.ts`
  - `src/tests/lib/exchange/*.test.ts` (seed/read in `fake.tables.exchangeWallet`)
  - `src/tests/lib/vault/exchange-wallet-safety.test.ts`
- **`exchangeTransaction`**:
  - `src/lib/vault/exchange-service.ts`
  - `src/lib/exchange/companies.ts`
  - `src/lib/exchange/sectors.ts`
  - `src/lib/exchange/shares.ts`
  - `src/lib/exchange/bonds.ts` (only selects `{ id: true }` / `{ metadata: true }`)
  - `src/server/api/routers/sports/leagues/crud.ts` (only selects `{ id: true }`)
  - `src/tests/helpers/sports-world.ts`
  - `src/tests/server/api/routers/sports-create-league-wiki.test.ts`
  - `src/tests/scenarios/engines/{sports-club-fees,sports-league-moves,sports-transfer-escrow}.test.ts`
  - `src/tests/lib/exchange/{treasury,sectors-decisions}.test.ts`
  - `src/tests/lib/vault/exchange-wallet-safety.test.ts`
- **`nationTreasury`**:
  - `src/lib/exchange/{treasury,fund,lending,bonds,operations,distress,contracts,contract-settlement,expiry,feedback,policy-watch,terminal}.ts`
  - `src/tests/lib/exchange/{treasury,fund,lending,bonds,operations,distress,tenders-expiry,market,company-wiki-and-audit,terminal}.test.ts`
- **`nationTreasuryEntry`**:
  - `src/lib/exchange/{treasury,bonds,terminal}.ts`
  - `src/tests/lib/exchange/{treasury,market,bonds,distress}.test.ts`
- **`company`**:
  - `src/lib/exchange/{companies,valuation,operations,distress,decisions,acquisition,governance,shares,fills,dividends,contracts,contract-settlement,expiry,sectors,lending,feedback,terminal}.ts`
  - `src/server/api/routers/exchange/companies.ts`
  - `src/tests/lib/exchange/*.test.ts`
- **`companyValueHistory`**:
  - `src/lib/exchange/{companies,valuation,decisions,terminal}.ts`
  - `src/tests/lib/exchange/{treasury,companies-contracts,sectors-decisions,terminal}.test.ts`
- **`shareIssuance`**:
  - `src/lib/exchange/shares.ts`
  - `src/tests/lib/exchange/shares-dividends.test.ts`
- **`shareListing`**:
  - `src/lib/exchange/{shares,fills,companies,acquisition,distress,fund,terminal}.ts`
  - `src/tests/lib/exchange/{shares-dividends,fund,acquisition,distress,company-wiki-and-audit,terminal}.test.ts`
- **`shareBuyOrder`**:
  - `src/lib/exchange/{shares,fills,acquisition,distress,fund,terminal}.ts`
  - `src/tests/lib/exchange/{shares-dividends,fund,acquisition,distress,terminal}.test.ts`
- **`shareholding`**:
  - `src/lib/exchange/{companies,shares,fills,ownership,acquisition,distress,governance,fund,terminal}.ts`
  - `src/tests/lib/exchange/{shares-dividends,fund,acquisition,governance,distress,news,company-wiki-and-audit,terminal}.test.ts`
- **`companyDividend`**:
  - `src/lib/exchange/{dividends,terminal}.ts`
  - `src/tests/lib/exchange/shares-dividends.test.ts`
- **`nationBond`**:
  - `src/lib/exchange/{bonds,fund,terminal}.ts`
  - `src/tests/lib/exchange/{bonds,fund,terminal}.test.ts`
- **`bondHolding`**:
  - `src/lib/exchange/{bonds,fund,terminal}.ts`
  - `src/tests/lib/exchange/{bonds,fund,terminal}.test.ts`
- **`bondListing`**:
  - `src/lib/exchange/{bonds,fund,terminal}.ts`
  - `src/tests/lib/exchange/{bonds,fund,terminal}.test.ts`
- **`contract`**:
  - `src/lib/exchange/{contracts,contract-settlement,expiry,companies,acquisition,distress,terminal}.ts`
  - `src/tests/lib/exchange/{companies-contracts,tenders-expiry,acquisition,distress,terminal}.test.ts`
- **`contractBid`**:
  - `src/lib/exchange/{contracts,contract-settlement,expiry,companies,acquisition,distress,terminal}.ts`
  - `src/tests/lib/exchange/{companies-contracts,tenders-expiry,acquisition,distress,terminal}.test.ts`
- **`sectorIndex`**:
  - `src/lib/exchange/{sectors,companies,terminal}.ts`
  - `src/tests/lib/exchange/{sectors-decisions,market,fund,terminal}.test.ts`
- **`sectorIndexHistory`**:
  - `src/lib/exchange/{sectors,terminal}.ts`
  - `src/tests/lib/exchange/{sectors-decisions,terminal}.test.ts`
- **`sectorPosition`**:
  - `src/lib/exchange/{sectors,fund,terminal}.ts`
  - `src/tests/lib/exchange/{sectors-decisions,fund,terminal}.test.ts`
- **`conversionLog`**:
  - None in runtime `src/` or `scripts/` (schema + `src/tests/architecture/erasure-coverage.test.ts` only).
- **`companyDecision`**:
  - `src/lib/exchange/{decisions,acquisition,distress,terminal}.ts`
  - `src/tests/lib/exchange/{sectors-decisions,acquisition,distress,terminal}.test.ts`
- **`companyProposal`** / **`companyVote`**:
  - `src/lib/exchange/{governance,acquisition,distress,shares,terminal}.ts`
  - `src/tests/lib/exchange/{governance,acquisition,distress,shares-dividends,terminal}.test.ts`
- **`exchangeNewsItem`** / **`exchangeNationSnapshot`** / **`exchangeWatch`**:
  - `src/lib/exchange/{news,policy-watch,watchlist,terminal}.ts`
  - `src/tests/lib/exchange/{news,policy-watch,market,bonds,terminal}.test.ts`
