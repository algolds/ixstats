# The Exchange (₷ Sovereigns)

**Last updated:** 2026-10-06 · **Status:** 🟡 MVP and phase 2 live behind a vault flag (on by default): conversion,
companies, B2B contracts and B2G tenders, the share market and dividends, sector indices and funds, company decisions.
The two Exchange cron jobs are off until named in `CRON_ENABLED_JOBS`. Design, phase 2 and what is left:
[specs/2026-10-06-exchange-economy-design.md](../specs/2026-10-06-exchange-economy-design.md).

The Exchange is the in-world capital economy, in its own currency, the Sovereign (₷). It is kept apart from
[IxCredits](ixcredits.md): conversion is the only way between them, and ₷ can only go back to IxC up to what a player
converted in plus a share of aged contract revenue. MyClub ([myleague.md](myleague.md)) also spends and earns ₷ through
the same wallet.

## Where it lives

| Layer | Location |
|---|---|
| Page | `/vault/exchange` (`src/app/vault/exchange/page.tsx` → `VaultExchangeSection`); Vault sidebar entry "Exchange" |
| UI | `src/components/vault/sections/exchange/`: `SovereignWalletCard` (balance, convert, recent activity), `CompaniesCard` (charter, deposit, withdraw, dissolve) + `CompanyControls` (trading switch, share issue, dividend, decisions), `ContractsCard` + `ContractRow` + `ContractForm` (open/mine lists, post a contract or a nation's tender, bid, award, complete, cancel, release, dispute), `SharesCard` (share market, my shares, list for sale), `SectorsCard` (indices with history, fund buy/sell) |
| Admin | `/admin/vault` → **Exchange** tab (`src/app/admin/vault/ExchangeAdmin.tsx`): rates and limits, contract revenue share and hold, disputes, ₷ adjustments. On/off switch: **System config** → "Enable the Exchange" |
| Router | `api.exchange.*` (`src/server/api/routers/exchange/`). `index.ts`: `getOverview`, `convert`, `listCompanies`, `foundCompany`, `depositToCompany`, `withdrawFromCompany`, `dissolveCompany`, `listContracts`, `createContract`, `placeBid`, `withdrawBid`, `awardContract`, `completeContract`, `cancelContract`, `releaseContract`, `disputeContract`. `markets.ts`: `getShareMarket`, `setShareTrading`, `issueShares`, `listShares`, `cancelShareListing`, `buyShares`, `declareDividend`, `getCompanyRecord`, `submitDecision`, `getSectors`, `buySectorUnits`, `sellSectorUnits`, `createTender`. `admin.ts`: `adminGetExchangeConfig`, `adminSaveExchangeConfig`, `adminListDisputes`, `adminResolveDispute`, `adminAdjustSovereigns` |
| Wallet ledger | `src/lib/vault/exchange-service.ts`: `getOrCreateWallet`, `earnSovereignsTx`, `spendSovereignsTx`, `lockWallet`, `exchangeService.earn/spend` (MyClub's entry point) |
| Config | `src/lib/vault/exchange-config.ts` (`exchange_*` SystemConfig keys, clamped); flag `isExchangeEnabled` in `src/lib/vault/vault-perks.ts` |
| Logic | `src/lib/exchange/`: `conversion.ts`, `companies.ts`, `contracts.ts` (B2B and B2G), `shares.ts`, `dividends.ts`, `ownership.ts` (holders, company lock, exact pro rata split), `sectors.ts`, `decisions.ts`, `expiry.ts`, `market.ts`, `notify.ts`, `queries.ts`, `guards.ts`, `quote.ts` (pure, shared with the UI) |
| Jobs | `exchange-market` (`7 */6 * * *`, `market.ts` `runExchangeMarketTick`) and `exchange-contract-expiry` (`*/15 * * * *`, `expiry.ts` `expireLapsedContracts`) in `src/server/cron/jobs.ts`; both off unless named in `CRON_ENABLED_JOBS` |
| Schema | `prisma/schema/exchange.prisma` |
| Tests | `src/tests/lib/vault/exchange-wallet-safety.test.ts`, `src/tests/lib/exchange/` (conversion, companies and contracts, shares and dividends, sectors and decisions, tenders and expiry, notifications), `src/tests/server/api/routers/exchange-router.test.ts` (in-memory database: `src/tests/helpers/fake-exchange-db.ts`) |

## Money rules

- **Wallets** start at 1,000 ₷ (`exchange_seed_sovereigns`); the seed is written once even when first visits race.
- **Spending** is a conditional decrement: a wallet never goes negative and concurrent spends can't overdraw it.
  `exchangeService.spend` returns `{ success: false }` on a shortfall; `spendSovereignsTx` throws `ExchangeError` so the
  caller's transaction rolls back.
- **Idempotency:** pass `idempotencyKey` (namespaced, e.g. `exchange:convert:<userId>:<requestId>`). The wallet row is
  locked, the key looked up, and the unique index on `exchange_transactions.idempotencyKey` is the backstop.
- **Conversion:** rate (default 1 ₷ per IxC), 5% fee each way, 10,000 ₷ per user per UTC day, convert-out allowance =
  ₷ converted in + `exchange_revenue_convertible_share` (default 0.5) of contract revenue completed at least
  `exchange_revenue_hold_days` (default 7) ago − ₷ converted out. Vault types `SPEND_EXCHANGE` / `EARN_EXCHANGE`; the
  vault earning kill switch stops conversion out.
- **Companies:** charter fee 1,000 ₷ (burned), 3 active per player, 1,000 founder shares. Capital moves only with
  conditional updates; contracts escrow from it and pay into it. Once anyone else holds shares (or a new issue is on
  sale), the founder can't withdraw capital: it leaves only as dividends or on dissolution, pro rata.
- **Contracts:** OPEN → AWARDED → COMPLETED, with cancel (issuer, while open), release (contractor, once awarded,
  standing −1), dispute (either party; an admin pays the contractor or refunds the issuer) and expiry (the job, 3 days
  after bidding closes with no award). Every transition is a conditional update on the current status, so escrow is
  paid out once. A **B2G tender** is posted by a nation's owner and escrowed from their wallet; a winner in the
  tender's sector earns +2 standing.
- **Shares:** fixed-price listings. A primary issue (founder only) sells new shares at fair value per share into
  capital; a secondary listing escrows a holder's shares until sold or cancelled. The founder switches trading on or
  off (off at charter). Trades lock the company row, then wallets in user-id order.
- **Dividends:** pro rata to all shares held (listed ones included), each payout rounded down to a cent; capital drops
  by exactly the sum paid, so no ₷ is created or lost.
- **Sector funds:** buy and sell units at fund ₷ ÷ units. Each `exchange-market` run moves each index at most 5% toward
  its activity target and rebalances the four funds by relative growth, exact to the cent: no ₷ is minted. A sale waits
  24 hours after the seller's last buy in that sector.
- **Decisions:** one pending per company, paid from capital at once (burned). `EXPAND` adds its cost to fair value,
  `ENTER_SECTOR` (500 ₷) moves the company; the market job applies them a day later, once each.

## Ledger types

`ExchangeTransaction.type`: `CONVERT_IN`, `CONVERT_OUT`, `CHARTER_FEE`, `COMPANY_DEPOSIT`, `COMPANY_WITHDRAW`,
`SHARE_BUY`/`SHARE_SELL` (share trades, source `SHARES:<companyId>`; MyClub also uses them for transfer escrow),
`DIVIDEND` (dividends and liquidation payouts), `SECTOR_BUY`/`SECTOR_SELL` (source `SECTOR_FUND:<sector>`),
`CONTRACT_ESCROW`/`CONTRACT_REFUND` (wallet-funded tenders), `CONTRACT_PAYOUT` (reserved), `ADMIN_ADJUSTMENT` (also
the wallet seed, source `WALLET_SEED`), and MyClub's `STADIUM_UPGRADE`, `TRAINING_FEE`, `TEAM_TRAINING`,
`PREDICTION_STAKE`, `PREDICTION_PAYOUT`. Contract payouts land in company capital, so they show on the contract and bid
rows, not the wallet ledger; dividends are also recorded per company in `CompanyDividend`.

## Notifications

Bids (to the issuer), awards (winner; losing bidders at low priority), completions, releases, disputes and dispute
decisions (both parties), expiries, share sales, dividends and applied decisions go through `notificationAPI` as
"economic" notices from source `exchange` (`src/lib/exchange/notify.ts`), so each recipient's category toggle and
minimum urgency apply. They are sent after the transaction commits and never block or undo a move.

## Known gaps

- `RND`, `ACQUIRE`, `LOBBY` and `PRICE` decisions, admin- or sim-issued tenders (a ₷ faucet), a nation ₷ treasury and an
  order book are not built (spec §8, "Still not built").
- Sector indices follow Exchange activity, not `SectoralOutput`; nothing sets `SectorIndex.dmModifier` yet.
- Two colluding accounts can move ₷ through contracts (and so some IxC through the relaxed out allowance), or drain a
  company's capital through a contract to an accomplice; fees, the hold, the share and the daily cap bound it.
- MyClub's ₷ spends ignore the Exchange flag and vault maintenance mode on purpose (they predate the Exchange).
- There is no admin-registered event key for Exchange notifications; the notification guard treats `exchangeNotification`
  as enabled.
