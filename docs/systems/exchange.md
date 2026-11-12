# The Exchange (₷ Sovereigns)

**Last updated:** 2026-11-08 · **Status:** 🟢 Terminal R2: nation wealth funds, lending terms, trading as the treasury, `#business` press from ThinkPages and realm sector levers, on top of R1: the Exchange is its own app at `/exchange`, public to watch (actions need sign-in), with a front page (realm index, Today in business, sectors, movers, nation bonds, live activity), markets, company, bond, nation and story pages, a portfolio with watchlist and alerts, leaderboards, a trade sheet, and nation bonds with credit ratings and default. Underneath, the Phase 3 engine: realm-scoped companies with 12 sub-industries and HQ domiciles, nation ₷ treasuries and DM faucet tenders, a two-sided order book with capital-gains and dividend withholding taxes, company decisions, shareholder governance and M&A, central bank credit, the `ACTIVE → DISTRESSED → BANKRUPT` lifecycle and bounded corporate-to-GDP feedback. Design specs: [specs/2026-11-06-exchange-overhaul-design.md](../specs/2026-11-06-exchange-overhaul-design.md) (the terminal), [specs/2026-11-01-exchange-phase-3-design.md](../specs/2026-11-01-exchange-phase-3-design.md) and [specs/2026-10-06-exchange-economy-design.md](../specs/2026-10-06-exchange-economy-design.md). Brand: [exchange-brand-guide.md](exchange-brand-guide.md). Deploy: [deploy-exchange-terminal-2026-11.md](../history/operations/deploy-exchange-terminal-2026-11.md).

The Exchange is the in-world capital economy, in its own currency, the Sovereign (₷). It is kept entirely apart from
[IxCredits](ixcredits.md): there is no conversion in either direction, so ₷ comes from the starting balance, contracts,
shares, dividends, sector funds, operating revenue, nation treasuries and MyClub. MyClub ([myleague.md](myleague.md)) also spends and earns ₷ through the
same wallet.

**Access:** the Exchange is its own app at `/exchange` (`src/app/exchange/layout.tsx` mounts one `ExchangeRouter`; the page files render nothing). It is public to watch: `src/proxy.ts` lists `/exchange` as a public route and every read on the front page, markets and object pages is a `publicProcedure`. Every action is a signed-in, rate-limited mutation that checks `vault_isExchangeEnabled`. The old addresses `/labs/exchange` and `/vault/exchange` answer with a 308 to `/exchange`, keeping the query (`src/lib/navigation/moved-pages.ts`). Sidebar sections (`src/lib/navigation/app-sections.ts`): Front page, Markets, Tenders, Leaderboards for everyone; Portfolio and My companies when signed in; Treasury for a nation owner (`nation-owner`).

## Where it lives

| Layer | Location |
|---|---|
| Pages | `/exchange` (front page), `/exchange/markets` (`?kind=companies\|bonds\|funds`, `?q=`), `/exchange/tenders`, `/exchange/leaderboards`, `/exchange/portfolio`, `/exchange/companies`, `/exchange/treasury`, and object pages `/exchange/c/[id]`, `/exchange/b/[id]`, `/exchange/n/[id]`, `/exchange/s/[id]`; the realm is `?realm=` (default: the viewer's realm). Addresses: `src/lib/exchange/routes.ts`. Also `/mycountry/economy?tab=corporations` (`CorporationsTreasuryConsole`) |
| UI | `src/components/exchange/terminal/` (zero-tell locked): `ExchangeRouter`, `ExchangeHeader`, `brand.tsx` (wordmark, `Figure`, `ChangeLabel`, `Pill`), `FrontPage`, `MarketsPage`, `LeaderboardsPage`, `CompanyPage`, `BondPage`, `NationPage`, `StoryPage`, `PortfolioPage`, `TreasuryPage`, `DeskPages` (Tenders, My companies), `TradeSheet`, `WatchStar`, `NewsList`, `IndexChart`. Reused from `src/components/exchange/`: `CompaniesCard` + `CompanyControls` (My companies), `ContractsCard` + `ContractRow` + `ContractForm` (Tenders), `shared.tsx`. Brand: [exchange-brand-guide.md](exchange-brand-guide.md) |
| MyCountry UI | `src/components/mycountry/shell/CorporationsTreasuryConsole.tsx` (`Corporations` tab in `EconomyDrillDown.tsx`), corporate telemetry in `EconomyRail.tsx`, and executive alerts in `deriveAgendaItems.ts` |
| Admin | `/admin/vault` → **Exchange** tab (`src/app/admin/vault/ExchangeAdmin.tsx`): charter fee, company cap, starting balance, treasury daily stipend/cap, realm weekly faucet cap, realm operating budget, manual market tick runner (`adminRunMarketTick`), sector DM modifiers (`adminSetSectorDmModifier`), disputes, ₷ adjustments. On/off switch: **System config** → "Enable the Exchange" |
| Router | `api.exchange.*` (`src/server/api/routers/exchange/`). `index.ts`: `getOverview`, `listCompanies`, `foundCompany`, `depositToCompany`, `withdrawFromCompany`, `dissolveCompany`, `listContracts`, `createContract`, `placeBid`, `withdrawBid`, `awardContract`, `completeContract`, `cancelContract`, `releaseContract`, `disputeContract`. `markets.ts`: `getShareMarket`, `getOrderBook`, `setShareTrading`, `issueShares`, `listShares`, `cancelShareListing`, `buyShares`, `placeBuyOrder`, `cancelBuyOrder`, `declareDividend`, `getCompanyRecord`, `submitDecision`, `getSectors`, `buySectorUnits`, `sellSectorUnits`, `setSectorDmModifier`, `createTender`. `governance.ts`: `listProposals`, `openProposal`, `castVote`, `getAcquisitionOffers`. `treasury.ts`: `getTreasury`, `getRealmCorporateSummary`, `createTreasuryTender`, `createFaucetTender`, `borrowCredit`, `repayCredit`. `terminal.ts`: public `realms`, `frontPage`, `markets`, `companyPage`, `bondPage`, `nationPage`, `story`, `news`, `leaderboards`; signed-in `portfolio`, `toggleWatch`, `issueBond`, `buyBondPrimary`, `listBondUnits`, `buyBondListing`, `cancelBondListing`. `admin.ts`: `adminGetExchangeConfig`, `adminSaveExchangeConfig`, `adminRunMarketTick`, `adminSetSectorDmModifier`, `adminListDisputes`, `adminResolveDispute`, `adminAdjustSovereigns` |
| Wallet ledger | `src/lib/vault/exchange-service.ts`: `getOrCreateWallet`, `earnSovereignsTx`, `spendSovereignsTx`, `lockWallet`, `exchangeService.earn/spend` (MyClub's entry point) |
| Config | `src/lib/vault/exchange-config.ts` (`exchange_*` SystemConfig keys, clamped); flag `isExchangeEnabled` in `src/lib/vault/vault-perks.ts` |
| Logic | `src/lib/exchange/`: `taxonomy.ts` (4×12 sub-industries, supply-chain multipliers, credit ratings), `macro.ts` (nation macro & realm GDP sector weights), `treasury.ts` (Nation ₷ Treasury ledger & stipends), `companies.ts`, `contracts.ts` + `contract-settlement.ts` + `tariffs.ts` (B2B, B2G treasury/wallet, DM faucet, cross-border tariffs & FTAs), `shares.ts` + `fills.ts` (two-sided Bid/Ask order book & cap-gains tax), `dividends.ts`, `ownership.ts`, `sectors.ts`, `decisions.ts` (6 decision types), `governance.ts` (shareholder proposals & ballots), `acquisition.ts` (pro-rata M&A buyouts), `operations.ts` (tick P&L statement), `credit.ts` (Central Bank credit lines), `distress.ts` (`ACTIVE → DISTRESSED → BANKRUPT`), `feedback.ts` (`±5%` GDP level adjustment via `syncLevelEffects`), `expiry.ts`, `market.ts` (`runExchangeMarketTick`), `valuation.ts` (fair value and credit math, client-safe), `bonds.ts` (nation bonds, ratings, weekly coupons, default), `news.ts` (business news and live activity, watcher alerts), `policy.ts` (policy headlines from tick-to-tick snapshots), `terminal.ts` + `terminal-valuation.ts` (the terminal's read models; prices, the portfolio and leaderboards in the second), `routes.ts` (addresses), `notify.ts`, `queries.ts`, `guards.ts`, `amounts.ts` |
| Jobs | `exchange-market` (`7 */6 * * *`, `market.ts` `runExchangeMarketTick`) and `exchange-contract-expiry` (`*/15 * * * *`, `expiry.ts` `expireLapsedContracts`) in `src/server/cron/jobs.ts`; both off unless named in `CRON_ENABLED_JOBS` |
| Schema | `prisma/schema/exchange.prisma` (`ExchangeWallet`, `ExchangeTransaction`, `Company`, `CompanyValueHistory`, `ShareIssuance`, `Shareholding`, `ShareListing`, `ShareBuyOrder`, `CompanyDividend`, `CompanyDecision`, `CompanyProposal`, `CompanyVote`, `SectorIndex`, `SectorIndexHistory`, `SectorPosition`, `Contract`, `ContractBid`, `NationTreasury` (with `creditRating`, `bondBanUntil`), `NationTreasuryEntry`, `NationBond`, `BondHolding`, `BondListing`, `ExchangeNewsItem`, `ExchangeNationSnapshot`, `ExchangeWatch`) |
| Tests | `src/tests/lib/vault/exchange-wallet-safety.test.ts`, `src/tests/lib/exchange/` (11 unit test suites covering taxonomy, macro, treasury, companies/contracts, shares/dividends/orderbook, sectors/decisions, tenders/expiry, governance, acquisition, operations, distress, feedback, and market tick; in-memory database: `src/tests/helpers/fake-exchange-db.ts`), `src/tests/server/api/routers/money-router-gates.test.ts`, `src/tests/architecture/play-as-money.test.ts`, `src/tests/architecture/platform-real-time.test.ts`, `src/tests/architecture/facet-zero-dirs.test.ts` |

## Money & Simulation Rules

- **Wallets** start at 1,000 ₷ (`exchange_seed_sovereigns`), global per user; companies, contracts, sector indices/positions, order books, proposals and nation treasuries are scoped per `realmId` (defaulting to `"default"` for Ixnay).
- **Spending & Idempotency:** conditional decrements under row locks (`SELECT ... FOR UPDATE`), keyed on `idempotencyKey` (`exchange_transactions.idempotencyKey` and `exchange_nation_treasury_entries.idempotencyKey`).
- **Companies, Sub-Industries & Domicile:** charter fee 1,000 ₷ (burned), up to `activeCompanyCap` (3) active companies per player per realm, 1,000 founder shares. Each company chooses one of 12 sub-industries across the 4 macro sectors (`taxonomy.ts`) and an optional HQ nation (`hqCountryId`) in the same realm.
- **Nation ₷ Treasuries & Stipends:** each nation with domiciled companies or an existing treasury receives a tick stipend (`exchange_treasury_daily_stipend` ÷ 4 ticks/day, scaled `0.5x–2.0x` by `economicTier`) up to `exchange_treasury_cap` (`25,000 ₷`), plus corporate income taxes, capital-gains taxes, dividend withholding, cross-border tariffs, Central Bank loan interest, and `50%` of `LOBBY` spend.
- **Operating P&L & Realm Faucet Cap:** each 6-hour market tick (`operations.ts`) computes gross operating revenue (` ProductiveBase × BaseMargin × SectorIndexFactor × MacroGrowthFactor × SupplyChainFactor × PricingFactor`), deducts upkeep, inflation-scaled overhead, and credit interest, and transfers corporate tax on positive EBT to the HQ treasury. Net positive operating inflows from the system faucet are scaled pro rata so total minted operating revenue per realm per tick never exceeds `exchange_realm_operating_budget` (`500 ₷`/tick).
- **Central Bank Credit & Distress Lifecycle:** companies rated `AAA` through `B` can draw up to `min(250,000, 0.5 × (decisionValue + 0.25 × contractsWonValue))` from their HQ nation's treasury at the nation's base interest rate plus rating spread (`credit.ts`). If `capital <= 0` after a tick or `creditDrawn > 1.2 × creditLimit`, the company enters `DISTRESSED` with a 72-hour grace window (`distress.ts`). If uncured after 72 hours, it transitions to `BANKRUPT`, unwinding pre-award contracts, open acquisition offers and pending decisions into capital, cancelling open orders, repaying HQ treasury credit up to remaining capital (`PRINCIPAL`), distributing any surplus pro rata to shareholders, and applying `-2` standing. A closed issuer's founder can still confirm delivery on an `AWARDED` contract (`completeContract`); any later contract refund or returned acquisition offer for a closed company is credited to its HQ nation's treasury as `RECOVERY`.
- **Contracts & Tariffs:** B2B contracts escrow from company capital; B2G tenders escrow from the nation's `₷` treasury (`TREASURY`, default) or the owner's wallet (`WALLET`), and can link to a national Directive or Issue; DM faucet tenders (`FAUCET`) mint escrow up to `exchange_realm_weekly_faucet_cap` (`10,000 ₷` rolling 7d). Cross-border contract completions pay the issuing nation's sector tariff into its treasury unless an active `free_trade` agreement links the two nations (`tariffs.ts`).
- **Two-Sided Share Order Book & Taxes:** players post sell listings (`ShareListing`) or escrowed limit buy orders (`ShareBuyOrder`). Orders cross automatically by price-time priority at the resting order's price (`fills.ts`), refunding any price improvement to the buyer. Secondary sales with a positive gain over `avgCost` pay the HQ nation's capital-gains tax into its treasury; dividends withhold `50%` of the HQ capital-gains rate into the HQ treasury.
- **Decisions, Governance & M&A:** founders queue `EXPAND`, `ENTER_SECTOR`, `RND` (`efficiency` or deterministic `breakthrough`), `LOBBY` (`sector`, `b2g`, `tax_relief` for 14d), `PRICE` (`undercut`, `balanced`, `premium`), or `ACQUIRE` (`decisions.ts`). When outside shareholders hold `≥ 10%` of `sharesOutstanding`, direct calls to `dissolveCompany` and `issueShares` are refused (`CONFLICT`) — share dilutions (`ISSUE_SHARES`), voluntary liquidations (`DISSOLVE`), and acquisition offers (`ACQUIRE_OFFER`) must go through `openProposal` (`governance.ts`, `acquisition.ts`).
- **Macro Feedback Loop:** each tick (`feedback.ts`) computes a bounded `±5%` GDP level adjustment (`gdp_level_adjustment` via `syncLevelEffects`) for nations with domiciled companies from corporate net income, B2G completions, and bankruptcy penalties.

## Ledger types

- `ExchangeTransaction.type`: `CONVERT_IN` and `CONVERT_OUT` (historical only), `CHARTER_FEE`, `COMPANY_DEPOSIT`, `COMPANY_WITHDRAW`, `SHARE_BUY`, `SHARE_SELL`, `SHARE_ORDER_ESCROW`, `SHARE_ORDER_REFUND`, `DIVIDEND`, `SECTOR_BUY`, `SECTOR_SELL`, `CONTRACT_ESCROW`, `CONTRACT_REFUND`, `CONTRACT_PAYOUT`, `TREASURY_PAYMENT`, `BOND_BUY`, `BOND_SELL`, `BOND_COUPON`, `BOND_PRINCIPAL`, `ADMIN_ADJUSTMENT`, plus MyClub's `STADIUM_UPGRADE`, `TRAINING_FEE`, `TEAM_TRAINING`, `PREDICTION_STAKE`, `PREDICTION_PAYOUT`.
- `NationTreasuryEntry.type`: `STIPEND`, `TAX`, `TARIFF`, `INTEREST`, `PRINCIPAL`, `LOBBY`, `B2G_ESCROW`, `B2G_REFUND`, `RECOVERY`, `SPEND`, `BOND_SALE`, `BOND_COUPON`, `BOND_PRINCIPAL`, `FUND_RETURN`.

## Nation bonds (terminal R1)

- **Who issues:** a nation's owner, from Treasury.
- **Terms:** units of ₷100, 10 to 10,000 per issue, a 0.5% to 25% annual coupon, and 1 to 12 weeks.
- **Cap:** a nation's outstanding principal is capped at 4 × `exchange_treasury_cap`.
- **Buying:** players buy units from the treasury at face, or from other holders' listings.
- **Payments:** each week the market tick pays every holder's coupon from the treasury, and principal with the last
  coupon. Listed units earn coupons too, and are returned before principal is paid.
- **Default:** a treasury that can't cover a week defaults.
  - Holders get their pro-rata cents of the balance.
  - The bond goes `DEFAULTED`.
  - The nation is rated D, and can't issue for 30 days (`bondBanUntil`).
  - The default is a front-page story.
- **Ratings:** `nationRatingFor` sets a nation's rating from treasury cover for its outstanding bonds, one notch down
  for shrinking growth and one more for weak government. It runs after every issue and every paid week.

## Wealth fund and lending (terminal R2)

- **The fund account:** `ensureFundUser` makes one system user per nation (`treasury-fund-<countryId>`, Clerk id
  `system:treasury-fund-<countryId>`) with its own wallet, remembered as `NationTreasury.fundUserId`. It trades through the ordinary
  engine with request ids prefixed `fund:`, so every fill, fee and tax applies.
- **Moving money:** `depositToFund` debits the treasury (`SPEND`) and credits the fund wallet (`TREASURY_PAYMENT`);
  `withdrawFromFund` reverses it (`FUND_RETURN`). A deposit that would put more than half of treasury plus fund into
  the fund is refused (`LIMIT_REACHED`).
- **Guardrails:** owner only (`requireCountryOwner`). No buying the owner's companies (founded or held by the
  nation's owner), the nation's own bonds, or more than 25% of a company. Fund trades publish an activity item such
  as "Caphiria Treasury bought 5 Urcea bonds".
- **Out of player surfaces:** fund users are left out of leaderboards and never get notices (`isFundUser`).
- **Lending terms:** `NationTreasury.lendingSpread` (−0.02 to 0.10, added to the borrow rate, which never goes below 0) and `companyCreditCap`
  (default ₷250,000, at most the global credit cap) apply to companies domiciled in the nation. Lending is exempt from
  the self-dealing rule (owner ruling); B2G tender awards to the owner's companies are refused.

## Business press (terminal R2)

- **What shows:** public, top-level, unwarned ThinkPages posts tagged `#business` (any case) by an active media or
  government account of a realm nation, or by a company's linked corporate account (`Company.thinkpagesAccountId`).
- **Read live:** `listBusinessPosts` reads posts at request time and merges them into front page, company and nation
  news, so deleting, hiding or warning a post removes it. Government posts show under the nation's name, media under
  the account's display name, and linked accounts under the company's name. Each opens `/dashboard/post/<id>`.
- **Linking:** a founder links one of their own corporate accounts; an account speaks for one company at a time.

## Sector levers (terminal R2)

Realm moderators and site admins set each sector's `dmModifier` (−0.5 to 2) from Markets → Funds, through
`setSectorDmModifier`. The next index tick uses it, and every change is audited.

## Business news

- **What publishes:** engine moves publish to `exchange_news_items` inside their own transactions, once per key and
  never naming a user. They are trades, dividends, tender awards and deliveries, distress, bankruptcy, acquisitions,
  passed votes, new listings and bond events. The market tick adds policy headlines by comparing each followed
  nation's corporate and capital-gains tax, interest rate, sector tariffs and free-trade partners with the snapshot it
  stored last time.
- **Prominence:** `HEADLINE` items fill Today in business, and `ACTIVITY` items fill the live feed. A large trade
  (≥ ₷5,000) is a headline.
- **Alerts:** watchers of a headline's company, bond or nation are notified, linking the story.

## Deploy: integer cents migration

All Exchange `₷` money columns in `prisma/schema/exchange.prisma` are stored as `BigInt` (`bigint` in PostgreSQL) holding exact integer cents (`1 ₷ = 100 cents`). Domain math runs in integer cents via `toCents`, `fromCents`, `centsOf`, and `dbCents` (`src/lib/exchange/amounts.ts`); API inputs and outputs remain `₷` numbers with at most 2 decimals.

### Operator Runbook

The conversion SQL (`prisma/migrations/20261109120000_exchange_integer_cents/migration.sql`) is **idempotent**: it
converts only while `exchange_wallets.sovereigns` is still `double precision`, and does nothing once converted. It must
run before `db push`, which would retype the same columns with a plain cast and no ×100 (every amount 1/100 of its
value). `scripts/deploy-production.sh`, `start-development.sh` (dev startup) and `scripts/refresh-local-db.sh` all run
it before their push, so dev startup converts a local database too.

`scripts/deploy-production.sh` also does steps 4 to 6 below on its own: when the conversion is pending it prints a
banner and `pm2 stop`s `ixstats-web`, `ixstats-cron` and `ixstats-ws` before the deploy SQL, and starts them again after
the PM2 reload, on the new build. A deploy that fails after the stop leaves them stopped (the old code must not run
against cents): fix the cause and run the deploy again. The market tick (`runExchangeMarketTick`) skips itself while the
Exchange is closed. A manual run follows the steps in order.

1. **Close the Exchange (maintenance mode):**
   `assertExchangeOpen` (`src/lib/exchange/guards.ts`) checks `getVaultConfig(db)` for `vault_isMaintenanceMode` (`cfg.isMaintenanceMode`) and `vault_isExchangeEnabled` (`cfg.isExchangeEnabled`). Close the Exchange before running the migration:
   ```sql
   INSERT INTO "system_config" ("id", "key", "value", "updatedAt")
   VALUES ('cfg_exchange_enabled', 'vault_isExchangeEnabled', 'false', NOW())
   ON CONFLICT ("key") DO UPDATE SET "value" = 'false', "updatedAt" = NOW();
   ```
   (Or toggle **Enable the Exchange** off in `/admin/vault` → **System config**.)

2. **Back up the database:**
   ```bash
   docker exec ixstats-postgres pg_dump -U postgres -Fc ixstats > /tmp/ixstats-pre-exchange-cents-$(date +%Y%m%d%H%M%S).dump
   ```

3. **Run read-only pre-flight checks (inspect sub-cent drift prior to rounding):**
   ```sql
   SELECT 'exchange_wallets' AS tbl, count(*) AS subcent_rows
   FROM "exchange_wallets"
   WHERE "sovereigns" * 100 <> round("sovereigns" * 100)
      OR "lifetimeEarned" * 100 <> round("lifetimeEarned" * 100)
      OR "lifetimeSpent" * 100 <> round("lifetimeSpent" * 100)
   UNION ALL
   SELECT 'exchange_transactions', count(*)
   FROM "exchange_transactions"
   WHERE "sovereigns" * 100 <> round("sovereigns" * 100)
      OR "balanceAfter" * 100 <> round("balanceAfter" * 100)
   UNION ALL
   SELECT 'exchange_nation_treasuries', count(*)
   FROM "exchange_nation_treasuries"
   WHERE "balance" * 100 <> round("balance" * 100)
      OR "companyCreditCap" * 100 <> round("companyCreditCap" * 100)
   UNION ALL
   SELECT 'exchange_companies', count(*)
   FROM "exchange_companies"
   WHERE "capital" * 100 <> round("capital" * 100)
      OR "fairValue" * 100 <> round("fairValue" * 100)
      OR "creditDrawn" * 100 <> round("creditDrawn" * 100)
   UNION ALL
   SELECT 'exchange_contracts', count(*)
   FROM "exchange_contracts"
   WHERE "value" * 100 <> round("value" * 100)
      OR "escrow" * 100 <> round("escrow" * 100)
      OR "tariffPaid" * 100 <> round("tariffPaid" * 100);
   ```

4. **Stop the writers:** the old code writes ₷ floats, which PostgreSQL silently casts into the bigint columns as if
   they were cents. Stop web, cron and websockets before the SQL:
   ```bash
   pm2 stop ixstats-web ixstats-cron ixstats-ws
   ```

5. **Apply the SQL migration (one transaction; a re-run does nothing):**
   ```bash
   docker exec -i ixstats-postgres psql -U postgres -d ixstats -v ON_ERROR_STOP=1 \
     < prisma/migrations/20261109120000_exchange_integer_cents/migration.sql
   ```

6. **Deploy the new application build, then start the writers:**
   Deploy the updated server and regenerate Prisma client (`bun run db:generate`), then start the stopped processes on
   the new build (a reload may leave a stopped process stopped):
   ```bash
   pm2 start ixstats-web ixstats-cron ixstats-ws --update-env
   ```

7. **Re-open the Exchange:**
   ```sql
   UPDATE "system_config" SET "value" = 'true', "updatedAt" = NOW()
   WHERE "key" = 'vault_isExchangeEnabled';
   ```

8. **Check for pre-existing stranded escrow on closed companies (read-only):**
   ```bash
   bun scripts/exchange/report-stranded-escrow.ts
   ```

### Non-money `Float` columns in `prisma/schema/exchange.prisma`

Every remaining `Float` column in `prisma/schema/exchange.prisma` is non-money and intentionally remains `Float`:

- `ExchangeTransaction.ixTime` — real-time epoch timestamp (ms)
- `Company.standing` — reputation score (`-10` to `+100`), not currency
- `Company.lobbyBuffUntilIxTime`, `lastTradeIxTime`, `distressedSinceIxTime`, `createdIxTime` — real-time epoch timestamps (ms)
- `CompanyValueHistory.recordedIxTime` — real-time epoch timestamp (ms)
- `ShareIssuance.issuedIxTime` — real-time epoch timestamp (ms)
- `ShareListing.createdIxTime` — real-time epoch timestamp (ms)
- `CompanyDividend.ixTime` — real-time epoch timestamp (ms)
- `SectorIndex.value`, `baseTotal`, `dmModifier`, `macroWeight` — dimensionless index level (base `1000`), activity baseline, DM multiplier (`-0.5` to `2.0`), and GDP share (`0` to `1`)
- `SectorIndex.computedIxTime` — real-time epoch timestamp (ms)
- `SectorIndex.unitsOutstanding` — fractional fund unit count
- `SectorIndexHistory.value`, `recordedIxTime` — dimensionless index level and real-time epoch timestamp (ms)
- `SectorPosition.units` — fractional fund unit count held by a user
- `ConversionLog.ixCredits`, `rate`, `ixTime` — IxCredits amount (vault currency, out of scope), conversion rate, and real-time epoch timestamp (ms)
- `CompanyDecision.submittedIxTime`, `appliedIxTime` — real-time epoch timestamps (ms)
- `Contract.endIxTime`, `createdIxTime`, `closedIxTime` — real-time epoch timestamps (ms)
- `Contract.tariffRate` — tariff fraction (`0` to `0.25`)
- `ContractBid.standingDelta`, `createdIxTime` — standing delta points and real-time epoch timestamp (ms)
- `NationTreasury.corporateGdpShift`, `lastStipendIxTime`, `lendingSpread` — GDP level fraction (`-0.05` to `+0.05`), real-time epoch timestamp (ms), and interest rate spread (`-0.02` to `+0.10`)
- `NationTreasuryEntry.ixTime` — real-time epoch timestamp (ms)
- `ShareBuyOrder.createdIxTime` — real-time epoch timestamp (ms)
- `CompanyProposal.expiresIxTime`, `resolvedIxTime` — real-time epoch timestamps (ms)
- `NationBond.couponRate` — annual coupon rate fraction (`0.005` to `0.25`)
- `ExchangeNewsItem.movePct` — relative percentage move for headlines
- `ExchangeNationSnapshot.corporateTaxRate`, `capGainsTaxRate`, `interestRate` — macroeconomic rate fractions
