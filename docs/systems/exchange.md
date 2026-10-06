# The Exchange (₷ Sovereigns)

**Last updated:** 2026-10-06 · **Status:** 🟡 MVP live behind a vault flag (on by default): conversion, companies and
B2B contracts. Design and phase 2 list: [specs/2026-10-06-exchange-economy-design.md](../specs/2026-10-06-exchange-economy-design.md).

The Exchange is the in-world capital economy, in its own currency, the Sovereign (₷). It is kept apart from
[IxCredits](ixcredits.md): conversion is the only way between them, and ₷ can only go back to IxC up to what a player
converted in. MyClub ([myleague.md](myleague.md)) also spends and earns ₷ through the same wallet.

## Where it lives

| Layer | Location |
|---|---|
| Page | `/vault/exchange` (`src/app/vault/exchange/page.tsx` → `VaultExchangeSection`); Vault sidebar entry "Exchange" |
| UI | `src/components/vault/sections/exchange/`: `SovereignWalletCard` (balance, convert, recent activity), `CompaniesCard` (charter, deposit, withdraw, dissolve), `ContractsCard` + `ContractRow` + `ContractForm` (open/mine lists, post, bid, award, complete, cancel, release, dispute) |
| Admin | `/admin/vault` → **Exchange** tab (`src/app/admin/vault/ExchangeAdmin.tsx`): rates and limits, disputes, ₷ adjustments. On/off switch: **System config** → "Enable the Exchange" |
| Router | `api.exchange.*` (`src/server/api/routers/exchange/`): `getOverview`, `convert`, `listCompanies`, `foundCompany`, `depositToCompany`, `withdrawFromCompany`, `dissolveCompany`, `listContracts`, `createContract`, `placeBid`, `withdrawBid`, `awardContract`, `completeContract`, `cancelContract`, `releaseContract`, `disputeContract`; admin: `adminGetExchangeConfig`, `adminSaveExchangeConfig`, `adminListDisputes`, `adminResolveDispute`, `adminAdjustSovereigns` |
| Wallet ledger | `src/lib/vault/exchange-service.ts`: `getOrCreateWallet`, `earnSovereignsTx`, `spendSovereignsTx`, `lockWallet`, `exchangeService.earn/spend` (MyClub's entry point) |
| Config | `src/lib/vault/exchange-config.ts` (`exchange_*` SystemConfig keys, clamped); flag `isExchangeEnabled` in `src/lib/vault/vault-perks.ts` |
| Logic | `src/lib/exchange/`: `conversion.ts`, `companies.ts`, `contracts.ts`, `queries.ts`, `guards.ts`, `quote.ts` (pure, shared with the UI) |
| Schema | `prisma/schema/exchange.prisma` |
| Tests | `src/tests/lib/vault/exchange-wallet-safety.test.ts`, `src/tests/lib/exchange/`, `src/tests/server/api/routers/exchange-router.test.ts` (in-memory database: `src/tests/helpers/fake-exchange-db.ts`) |

## Money rules

- **Wallets** start at 1,000 ₷ (`exchange_seed_sovereigns`); the seed is written once even when first visits race.
- **Spending** is a conditional decrement: a wallet never goes negative and concurrent spends can't overdraw it.
  `exchangeService.spend` returns `{ success: false }` on a shortfall; `spendSovereignsTx` throws `ExchangeError` so the
  caller's transaction rolls back.
- **Idempotency:** pass `idempotencyKey` (namespaced, e.g. `exchange:convert:<userId>:<requestId>`). The wallet row is
  locked, the key looked up, and the unique index on `exchange_transactions.idempotencyKey` is the backstop.
- **Conversion:** rate (default 1 ₷ per IxC), 5% fee each way, 10,000 ₷ per user per UTC day, convert-out allowance =
  ₷ converted in − ₷ converted out. Vault types `SPEND_EXCHANGE` / `EARN_EXCHANGE`; the vault earning kill switch stops
  conversion out.
- **Companies:** charter fee 1,000 ₷ (burned), 3 active per player, 1,000 founder shares. Capital moves only with
  conditional updates; contracts escrow from it and pay into it.
- **Contracts:** OPEN → AWARDED → COMPLETED, with cancel (issuer, while open), release (contractor, once awarded,
  standing −1) and dispute (either party; an admin pays the contractor or refunds the issuer). Every transition is a
  conditional update on the current status, so escrow is paid out once.

## Ledger types

`ExchangeTransaction.type`: `CONVERT_IN`, `CONVERT_OUT`, `CHARTER_FEE`, `COMPANY_DEPOSIT`, `COMPANY_WITHDRAW`,
`CONTRACT_PAYOUT` (reserved), `ADMIN_ADJUSTMENT` (also the wallet seed, source `WALLET_SEED`), and MyClub's
`STADIUM_UPGRADE`, `TRAINING_FEE`, `TEAM_TRAINING`, `PREDICTION_STAKE`, `PREDICTION_PAYOUT`, `SHARE_BUY`/`SHARE_SELL`
(transfer escrow). Contract payouts land in company capital, so they show on the contract and bid rows, not the wallet
ledger.

## Known gaps

- No share trading, sector indices, company decisions or B2G tenders yet (phase 2 in the spec).
- OPEN contracts past their bidding window stay OPEN until the issuer awards or cancels them; there is no expiry job.
- MyClub's ₷ spends ignore the Exchange flag and vault maintenance mode on purpose (they predate the Exchange).
- No notifications for bids, awards or dispute decisions.
