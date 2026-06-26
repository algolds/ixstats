# Plan: Exchange — Phase 1 (P0) Implementation

## Context

The Exchange PRD (`Exchange_v1_PRD.md`, v0.2) is locked: names settled (**Exchange** product · **MyPortfolio** surface · **Sovereign ₷** currency · **Sectors** instruments · **Convert** bridge), data model sketched (§9), and Phase 1 = the P0 set (§10). This plan turns P0-1…P0-8 into a buildable, sequenced implementation that **mirrors existing IxStates patterns** rather than inventing new ones.

**Decisions captured this session:** build the **full P0** as ordered milestones; **Sectors = 4 global macro-sector indices** (Agriculture / Industry / Services / Government) aggregated from `SectoralOutput` across the ~82 nations, normalized to a base of 1000 at epoch.

**Core loop being built:** found a Company (charter fee in Sovereign) → make periodic decisions + bid on contracts → the sim recomputes **fair value** on the IxTime tick → see it in **MyPortfolio**; meanwhile **Sectors** give live day-one market motion, and **Convert** is the throttled valve to IxCredits.

---

## Conventions to follow (all verified in-repo)

- **Prisma:** add a new `prisma/schema/exchange.prisma` (auto-merged via `prismaSchemaFolder`; `prisma.config.ts → schema:"prisma/schema"`). Enums go in `prisma/schema/enums.prisma`. Use `@id @default(cuid())`, `createdAt`/`updatedAt`, `@relation(... onDelete: Cascade)` to `User.id` (not `clerkUserId`), `@@index`, `@@map("snake_case")`. Reference shapes: `MyVault`/`VaultTransaction`/`CardValueHistory` in `cards.prisma`.
- **DB apply:** `bun run db:generate` then apply with **`db push`** (per memory `reference_ixstats_db_apply` — NOT `migrate dev`; history is drifted + prod has ~82 nations). Source `.env`, preview diff, push. **Never run global `tsc`/`typecheck:full`.**
- **Service layer:** `src/lib/exchange-service.ts` — class singleton mirroring `src/lib/vault-service.ts` (every method takes `db: PrismaClient`; `db.$transaction` for atomic balance+log; config cached from `SystemConfig`). Sovereign wallet is a **separate** table from `MyVault` (isolation).
- **Sim engine (pure, testable):** `src/lib/exchange/{sector-index,valuation,decisions,contracts}.ts` — no React/Prisma side effects in the math (mirror the modular `synergy-calculator.ts` pattern); return **breakdowns** for legibility.
- **tRPC:** `src/server/api/routers/exchange.ts`, registered in `src/server/api/root.ts` via `exchange: safeRouter("exchange", () => exchangeRouter)`. Use `protectedProcedure` (reads/most mutations), `adminProcedure` (DM tools). Context: `ctx.db`, `ctx.user.id`, `ctx.user.countryId`. Zod v4 inputs, `TRPCError`, `globalCache` (`advanced-cache-system.ts`), `rateLimiter` (`rate-limiter.ts`). Template: `routers/vault.ts`, `trading.ts`.
- **Cron:** `src/lib/exchange-tick-cron.ts` exporting tick fn; register in `server.mjs` via the `scheduleCron(name, schedule, handler)` helper (production-only). Gate cadence on IxTime: compare `IxTime.getCurrentGameYear()` + `IxTime.getMonthFromTimestamp(now)` to a **last-run key in `SystemConfig`**; guard `IxTime.isPaused()`. (`addMonths`, `getYearsElapsed`, `getTimeMultiplier` all exist.)
- **Frontend:** route `/exchange` mirroring the **vault surface** (Next.js routed sub-pages + `*SidebarLayout` + `*SidebarNav.getSectionFromPathname` + `sections/*`; `layout.tsx` wraps `AuthenticationGuard` from `~/components/mycountry/primitives`). Data via `api.exchange.*` from `~/trpc/react`. Charts via **recharts** (mirror `src/components/economy/historical-charts/TimeSeriesChart.tsx`). Glass primitives: `CutoutCard`, `TextureCard`, `glass-hierarchy-*`.
- **Nav + theming:** add Exchange to `src/hooks/useNavigationItems.ts`; `NAV_COLORS` + `contextualMenus` + `getContextKey()` in `src/lib/navigation-config.ts`; hover color in `src/components/navigation/NavigationBar.tsx`; `--glass-exchange: #14b8a6` in `src/styles/glass-refraction.css`. New `SovereignSymbol.tsx` (copy `src/components/vault/IxCreditsSymbol.tsx`).

---

## Data model — `prisma/schema/exchange.prisma` (maps to PRD §9)

| Model | Key fields | Mirrors |
|---|---|---|
| `ExchangeWallet` | userId @unique, sovereigns Float, lifetimeEarned/Spent | `MyVault` (isolated) |
| `ExchangeTransaction` | walletId, sovereigns, balanceAfter, type, source, metadata Json?, ixTime, createdAt | `VaultTransaction` |
| `Company` | founderId→User, name @unique, sectorKey, capital, standing, fairValue, sharesIssued, sharesOutstanding, status, createdIxTime, countryId? | — |
| `CompanyValueHistory` | companyId, fairValue, breakdown Json?, recordedIxTime | `CardValueHistory` |
| `ShareIssuance` | companyId, shares, pricePerShare, issuedIxTime | — |
| `Shareholding` | companyId, ownerUserId, shares, avgCost | `CardOwnership` |
| `SectorIndex` | sectorKey @unique, value, baseTotal, dmModifier, computedIxTime | — |
| `SectorIndexHistory` | sectorKey, value, recordedIxTime | `CardValueHistory` |
| `SectorPosition` | ownerUserId, sectorKey, units, avgCost (@@unique [ownerUserId, sectorKey]) | `Shareholding` |
| `ConversionLog` | userId, direction, ixCredits, sovereigns, rate, fee, ixTime | — (audit + sink) |
| `CompanyDecision` | companyId, type (enum), payload Json?, appliedIxTime?, effect Json? | — |
| `Contract` / `ContractBid` | type (B2G/B2B), value, sectorKey, status, endIxTime / companyId, amount, outcome, standingDelta | `CardAuction`/`AuctionBid` |

Enums in `enums.prisma`: `ExchangeTransactionType` (CONVERT_IN, CONVERT_OUT, CHARTER_FEE, SHARE_BUY, SHARE_SELL, CONTRACT_PAYOUT, ADMIN_ADJUSTMENT), `CompanyDecisionType` (EXPAND, RND, ENTER_SECTOR, ACQUIRE, LOBBY, PRICE), `ContractType` (B2G, B2B). *(Phase-2-only `ShareOrder`/`Dividend` are NOT built now but the schema leaves room.)*

---

## Milestones (sequenced; each is a testable slice)

### M1 — Foundation & market skeleton  *(P0-6 wallet, P0-3 partial, P0-7 shell)*
- `exchange.prisma` + enums; `db:generate` + `db push`.
- `exchange-service.ts`: `getOrCreateWallet`, `getBalance`, `earn`/`spend` (atomic + `ExchangeTransaction` log).
- `exchange/sector-index.ts` (pure) + a reader that aggregates `SectoralOutput` (latest year) across nations into the 4 macro indices, GDP-weighted, base 1000 (base captured to `SectorIndex.baseTotal` on first run).
- `routers/exchange.ts` (register in `root.ts`): `getWallet`, `listSectors`, `getSectorHistory`. 
- `/exchange` surface scaffold: `app/exchange/{page,layout}.tsx`, `components/exchange/{ExchangeSidebarNav,ExchangeSidebarLayout}.tsx`, `SovereignSymbol.tsx`, `sections/PortfolioSection.tsx` (wallet + sector list). Nav + `--glass-exchange` wired.
- **Delivers:** log in → see MyPortfolio with Sovereign balance and 4 live Sectors.

### M2 — Companies & management  *(P0-1, P0-2, P0-5)*
- Service: `charterCompany` (deduct charter fee, name-unique, **soft active-company cap** via count, seed capital + sector), `issueShares` (primary issuance at anchor).
- `exchange/decisions.ts` (type→effect) + `exchange/contracts.ts` (bid scoring = amount + standing). Contracts in v1 are **DM-seeded + a light auto-generator** (B2G derived from nation gov-spending, B2B random) — minimal, tunable.
- Router: `charterCompany`, `listMyCompanies`, `submitDecision`, `listContracts`, `bidContract`, `issueShares`.
- Sections: `CompaniesSection.tsx` (found + manage + decisions + contracts), company detail view.
- **Delivers:** charter a company, queue decisions, bid a contract, issue shares.

### M3 — Sim engine & tick  *(P0-3 full, P0-4, P0-8)*
- `exchange/valuation.ts` (pure): `fairValue = capital × sectorFactor × (1+ΣdecisionMods) × (1+standingMod) + contractsWonValue`, returning a **per-component breakdown** (feeds P0-7 legibility). Coefficients from `SystemConfig`.
- `exchange-tick-cron.ts` + register in `server.mjs`:
  - **monthly in-game tick** → recompute Sectors (+ `SectorIndexHistory`), resolve pending `CompanyDecision`s and `ContractBid`s, update company performance stats.
  - **quarterly in-game tick** → recompute every `Company.fairValue` (+ `CompanyValueHistory` with breakdown). *(dividends = Phase 2.)*
  - last-run tracked in `SystemConfig` keys; guarded by `isPaused()`; rescales via `getTimeMultiplier()`.
- **Delivers:** prices/anchors move on the IxTime clock with persisted history.

### M4 — Convert bridge & DM admin  *(P0-6 full)*
- Service `convert(direction, amount)`: IxCredits→Sovereign debits via `vaultService.spendCredits` then `exchangeService.earn(amount × rate × (1−fee))`; reverse analogous. `rateLimiter` + daily limit + `ConversionLog`. Rate/fee/limit from `SystemConfig`.
- Router: `convert` (protected, rate-limited); admin procedures `setSectorEvent` (DM modifier on a `SectorIndex`), `tuneConvert`, `seedContracts`.
- `/admin/exchange/page.tsx` (adminProcedure-backed) for the three DM levers.
- **Delivers:** controlled cross-economy flow + DM control surface.

### M5 — Legibility, charts & polish  *(P0-7 full)*
- recharts price-history charts for Sectors and Companies (mirror `TimeSeriesChart`); **valuation-breakdown panel** (sector vs decisions vs contracts vs standing) — the tracked legibility metric.
- Portfolio summary (holdings value, P/L), contextual menu entries, mobile nav strip, empty/loading states.
- **Delivers:** the full MyPortfolio dashboard per P0-7.

---

## Tunable config (SystemConfig keys — sensible defaults, flagged open in PRD §13)
`exchange_charter_fee`, `exchange_active_company_cap`, `exchange_convert_rate`, `exchange_convert_fee`, `exchange_convert_daily_limit`, `exchange_valuation_*` (coefficients), `exchange_last_sector_tick_ixtime`, `exchange_last_fairvalue_tick_ixtime`. All read through the cached-config helper; DM-editable via M4 admin.

## Files touched (representative)
- **New:** `prisma/schema/exchange.prisma`; `src/lib/exchange-service.ts`; `src/lib/exchange/{sector-index,valuation,decisions,contracts}.ts`; `src/lib/exchange-tick-cron.ts`; `src/server/api/routers/exchange.ts`; `src/app/exchange/**`; `src/components/exchange/**`; `src/app/admin/exchange/page.tsx`.
- **Edited:** `prisma/schema/enums.prisma`; `src/server/api/root.ts`; `server.mjs`; `src/hooks/useNavigationItems.ts`; `src/lib/navigation-config.ts`; `src/components/navigation/NavigationBar.tsx`; `src/styles/glass-refraction.css`.

## Verification (per milestone)
- After schema work: `bun run db:generate` + `db push` (source `.env`, preview diff first); confirm tables created.
- `bun run dev` (Turbopack) for incremental type checking — **never** global `tsc`/`typecheck:full`; `bun run lint` before wrapping a milestone.
- **M1:** `/exchange` shows wallet + 4 Sectors with values; `listSectors` returns data from real `SectoralOutput`.
- **M2:** charter a company end-to-end (fee deducted, appears in MyPortfolio, name-collision + cap enforced); submit a decision; bid a contract; issue shares.
- **M3:** manually invoke the tick fn (export a dev trigger) → Sectors + `CompanyValueHistory` rows written; verify month/quarter gating by advancing/inspecting IxTime; confirm `getTimeMultiplier()` rescaling.
- **M4:** Convert both directions adjusts both wallets correctly, respects fee/rate/daily-limit, writes `ConversionLog`; DM admin tunes config and injects a sector event that moves an index next tick.
- **M5:** charts render history; valuation-breakdown panel explains a fair-value move.
