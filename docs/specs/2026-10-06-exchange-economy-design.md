# The Exchange (₷) economy: design

**Last updated:** 2026-10-06 · **Status:** MVP built on `rose-garden` (2026-10-06); phase 2 below. System doc:
[systems/exchange.md](../systems/exchange.md). Decision: **D5 (a)** in the [roadmap](../roadmap/ROADMAP.md#decisions-needed),
backlog row VT-16.

## 1. What ₷ is for

| | IxCredits (IxC) | Sovereigns (₷) |
|---|---|---|
| Role | Account reward currency | In-world capital |
| Earned by | Play: dividends, activity, bonuses, card sales | Conversion from IxC, contract payouts, MyClub income, the wallet's starting balance |
| Spent on | Packs, cosmetics, card market | Company charters, company capital, contracts, MyClub (team claims, leagues, stadiums, predictions, transfers) |
| Ledger | `MyVault` + `VaultTransaction` (`lib/vault/vault-ledger.ts`) | `ExchangeWallet` + `ExchangeTransaction` (`lib/vault/exchange-service.ts`) |

The two economies are isolated. Conversion is the only valve, so nothing that happens in the Exchange can mint IxC.

**Starting balance:** new wallets get **1,000 ₷** (was 10,000), enough for a MyClub team claim, a league charter or a
company charter. Existing wallets keep their balance; no adjustment script is needed because seeded ₷ can't be
converted out (§2).

## 2. Conversion (IxC ⇄ ₷)

| Rule | Value |
|---|---|
| Directions | `CONVERT_IN` IxC → ₷ and `CONVERT_OUT` ₷ → IxC |
| Rate | `exchange_convert_rate` (₷ per IxC), admin-set, default 1.0, clamped to 0.1 to 100. No market rate in the MVP |
| Fee | `exchange_convert_fee`, default 5% each way (a sink), clamped to 0 to 50%. In: ₷ = IxC × rate × (1 − fee). Out: IxC = (₷ − fee) ÷ rate. Payouts round down to hundredths |
| Daily cap | `exchange_convert_daily_limit`, default 10,000 ₷ per user per UTC day, both directions summed |
| Out allowance | A user can convert out at most the ₷ they converted in, less what they already converted out. ₷ from the seed, MyClub or other players never becomes IxC, so the bridge can't mint IxC or move it between accounts |
| Vault XP | IxC coming back through `CONVERT_OUT` grants no vault XP and doesn't count as earned today, so round trips can't buy vault levels |
| Kill switches | The vault flag `vault_isExchangeEnabled` and vault maintenance mode stop all conversion; the vault earning kill switch (`vault_isEarningEnabled`) also stops `CONVERT_OUT`, whose IxC side is the new `EARN_EXCHANGE` type. The IxC side of `CONVERT_IN` is `SPEND_EXCHANGE` |

One database transaction does both sides through both ledgers (conditional decrements on each) and writes a
`ConversionLog` row with the rate and fee applied (fee stored in ₷). The user's wallet row is locked first, so the cap
and allowance checks can't race.

## 3. Companies

- **Who:** any signed-in player, up to `exchange_active_company_cap` ACTIVE companies (default 3), for
  `exchange_charter_fee` (default 1,000 ₷, burned). Names are unique, case-insensitively.
- **Ownership:** the charter issues 1,000 shares to the founder (`ShareIssuance` + `Shareholding`, price = fee ÷ 1,000).
  Share trading is phase 2, so the founder holds 100%.
- **What it does:** holds **capital**. The founder deposits ₷ from their wallet and withdraws it back. A company posts
  contracts (escrow comes from capital) and bids on other companies' contracts (payouts land in capital).
- **Revenue:** contract payouts. `contractsWonValue` and `standing` (+1 per completed contract, −1 per release or lost
  dispute) record its track record.
- **Fair value (MVP):** capital + 0.25 × contracts won + 100 × positive standing, recorded in `CompanyValueHistory` on
  every change. Phase 2 replaces it with the sector-index valuation.
- **Dissolve:** refused while the company issues or holds a live contract; pending bids are withdrawn, capital returns to
  the founder, status `DELISTED`.

## 4. Contracts (B2B)

**Parties:** an issuing company (its founder acts) and the winning bidder company. **Terms:** title, free-text terms,
sector, value, bidding window (1 to 30 days, stored as IxTime `endIxTime`). Bids are sealed: the issuer sees all of them,
a bidder only their own. A company can't bid on its own founder's contracts, and a bid is at most the value.

```
OPEN ──award──▶ AWARDED ──complete (issuer)──▶ COMPLETED
 │                 ├──release (contractor)──▶ CANCELLED
 └─cancel─▶ CANCELLED └──dispute (either)──▶ DISPUTED ──admin──▶ COMPLETED | CANCELLED
```

- **Escrow:** posting moves the value from the issuer's capital into `Contract.escrow`. Awarding keeps the bid amount and
  refunds the rest. Completion pays escrow to the winner's capital; cancel, release and a refund decision return it.
- **Disputes, kept simple:** either party can freeze an AWARDED contract with a reason. An admin either pays the
  contractor or refunds the issuer, with a note both parties see. No partial splits.
- Spam guard: 10 OPEN contracts per company.

## 5. Anti-abuse

- **Conditional decrements** everywhere money leaves: wallet (`sovereigns >= amount`), vault (`credits >= amount`),
  company capital (`capital >= amount`), and contract transitions (`status = from`). Two racing requests can move money
  or a contract only once.
- **Idempotency keys:** conversions, charters, deposits, withdrawals and contract posts take a client `requestId`;
  the key lands on a unique column (`ExchangeTransaction`, `ConversionLog`, `VaultTransaction`, `Contract`). A retry
  returns the first result; a racing duplicate loses on the unique index and its whole transaction rolls back.
- **Caps:** daily conversion cap, out allowance, company cap, open-contract cap, bids ≤ value, config values clamped.
- **Rate limits:** every mutation is `rateLimitedMutationProcedure` (per procedure, per user); admin ones `adminProcedure`.
- **Audit log:** every ₷ move is an `ExchangeTransaction` row with `balanceAfter` and metadata; every conversion a
  `ConversionLog` row; admin calls go through `adminProcedure`'s audit middleware, and balance adjustments record the
  admin and reason in the ledger metadata.

## 6. Flags and admin

`isExchangeEnabled` sits with the other vault flags (`vault_isExchangeEnabled`, admin: Vault and economy → System
config). It defaults **on**: conversion in is a sink, conversion out is bounded by what went in, charters are a sink and
contracts only move ₷ between players. It gates conversion, companies and contracts, never MyClub's ₷ spending. The
**Exchange** admin tab edits rate, fee, daily cap, charter fee, company cap and starting balance, lists disputes, and
adjusts ₷ balances (a debit never overdraws).

## 7. Schema (additive)

`ExchangeTransaction.idempotencyKey` and `ConversionLog.idempotencyKey` (nullable, unique); `Contract` gains
`issuerCompanyId` (relation `ContractIssuer`), `issuerUserId`, `description`, `escrow`, `awardedBidId`, `disputeReason`,
`disputedByUserId`, `resolutionNote`, `closedIxTime`, `idempotencyKey` (unique), `updatedAt`, plus indexes; two
`VaultTransactionType` values, `SPEND_EXCHANGE` and `EARN_EXCHANGE`. Now in use: 9 of the 13 Exchange models;
`SectorIndex`, `SectorIndexHistory`, `SectorPosition` and `CompanyDecision` wait for phase 2.

## 8. Phase 2 (not built)

- [ ] **Share trading:** issue more shares, a primary market at fair value, secondary trades between players
      (`SHARE_BUY`/`SHARE_SELL`), dividends from capital pro rata to `Shareholding`.
- [ ] **Sector indices:** compute `SectorIndex`/`SectorIndexHistory` from `SectoralOutput`, `SectorPosition` buy/sell,
      and the fair-value model using the `valuation*` weights.
- [ ] **Company decisions:** `CompanyDecision` (EXPAND, RND, LOBBY, ...) resolved on the IxTime tick.
- [ ] **B2G contracts:** admin- or sim-issued government tenders (a controlled ₷ faucet), sector-matched bonuses.
- [ ] **Expiry job:** a cron that cancels OPEN contracts past `endIxTime` with no award and refunds escrow.
- [ ] **Relaxed out allowance:** count verified contract revenue as convertible after a holding period.
- [ ] **Notifications** for bids, awards, payouts and dispute decisions.
