# The Exchange (₷) economy: design

**Last updated:** 2026-10-06 · **Status:** MVP and phase 2 built on `rose-garden` (2026-10-06); what is left is at the end of §8. System doc:
[systems/exchange.md](../systems/exchange.md). Decision: **D5 (a)** in the [roadmap](../roadmap/ROADMAP.md#decisions-needed),
backlog row VT-16.

## 1. What ₷ is for

| | IxCredits (IxC) | Sovereigns (₷) |
|---|---|---|
| Role | Account reward currency | In-world capital |
| Earned by | Play: dividends, activity, bonuses, card sales | Conversion from IxC, contract payouts, company dividends, share and fund sales, MyClub income, the wallet's starting balance |
| Spent on | Packs, cosmetics, card market | Company charters, company capital, contracts and tenders, shares, sector funds, MyClub (team claims, leagues, stadiums, predictions, transfers) |
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
| Out allowance | A user can convert out at most the ₷ they converted in, plus a share of verified contract revenue once it has aged (phase 2, §8.5), less what they already converted out. ₷ from the seed, MyClub, dividends, share sales or fund sales never becomes IxC |
| Vault XP | IxC coming back through `CONVERT_OUT` grants no vault XP and doesn't count as earned today, so round trips can't buy vault levels |
| Kill switches | The vault flag `vault_isExchangeEnabled` and vault maintenance mode stop all conversion; the vault earning kill switch (`vault_isEarningEnabled`) also stops `CONVERT_OUT`, whose IxC side is the new `EARN_EXCHANGE` type. The IxC side of `CONVERT_IN` is `SPEND_EXCHANGE` |

One database transaction does both sides through both ledgers (conditional decrements on each) and writes a
`ConversionLog` row with the rate and fee applied (fee stored in ₷). The user's wallet row is locked first, so the cap
and allowance checks can't race.

## 3. Companies

- **Who:** any signed-in player, up to `exchange_active_company_cap` ACTIVE companies (default 3), for
  `exchange_charter_fee` (default 1,000 ₷, burned). Names are unique, case-insensitively.
- **Ownership:** the charter issues 1,000 shares to the founder (`ShareIssuance` + `Shareholding`, price = fee ÷ 1,000).
  Shares then trade on the share market (§8.1). Control stays with the founder whatever share they hold.
- **What it does:** holds **capital**. The founder deposits ₷ from their wallet and withdraws it back. A company posts
  contracts (escrow comes from capital) and bids on other companies' contracts (payouts land in capital).
- **Revenue:** contract payouts. `contractsWonValue` and `standing` (+1 per completed contract, −1 per release or lost
  dispute) record its track record.
- **Fair value:** (capital + 0.25 × contracts won + 200 × `valuationStandingWeight` × positive standing) × sector factor
  + `valuationDecisionWeight` × `decisionValue`, where sector factor = 1 + `valuationSectorWeight` × (sector index ÷
  1,000 − 1), held to 0.5 to 2. With the default weights and an index at 1,000 it is the MVP formula (capital + 0.25 ×
  contracts won + 100 × positive standing). Recorded in `CompanyValueHistory` with its breakdown on every change and
  every market tick.
- **Withdrawals:** the founder withdraws capital only while nobody else holds shares and no new issue is on sale; after
  that, capital leaves only pro rata (dividends, dissolution).
- **Dissolve:** refused while the company issues or holds a live contract or has a decision pending; pending bids are
  withdrawn, open share listings cancelled (listed shares return to their holders), and capital is paid out pro rata to
  the shareholders (the founder takes the sub-cent remainder, so a sole founder gets it all); status `DELISTED`.

## 4. Contracts (B2B and B2G)

**Parties:** an issuing company (its founder acts), or for a government tender (B2G, §8.4) a nation's owner, and the
winning bidder company. **Terms:** title, free-text terms,
sector, value, bidding window (1 to 30 days, stored as IxTime `endIxTime`). Bids are sealed: the issuer sees all of them,
a bidder only their own. A company can't bid on its own founder's contracts, and a bid is at most the value.

```
OPEN ──award──▶ AWARDED ──complete (issuer)──▶ COMPLETED
 │                 ├──release (contractor)──▶ CANCELLED
 └─cancel─▶ CANCELLED └──dispute (either)──▶ DISPUTED ──admin──▶ COMPLETED | CANCELLED
```

- **Escrow:** posting moves the value from the issuer's capital (B2G: the owner's wallet) into `Contract.escrow`. Awarding keeps the bid amount and
  refunds the rest. Completion pays escrow to the winner's capital; cancel, release and a refund decision return it.
- **Disputes, kept simple:** either party can freeze an AWARDED contract with a reason. An admin either pays the
  contractor or refunds the issuer, with a note both parties see. No partial splits.
- **Expiry:** an OPEN contract never awarded within 3 days of its bidding window closing is cancelled by the
  `exchange-contract-expiry` job and its escrow refunded (§8.6).
- Spam guard: 10 OPEN contracts per company (and per nation for tenders).

## 5. Anti-abuse

- **Conditional decrements** everywhere money leaves: wallet (`sovereigns >= amount`), vault (`credits >= amount`),
  company capital (`capital >= amount`), and contract transitions (`status = from`). Two racing requests can move money
  or a contract only once.
- **Idempotency keys:** conversions, charters, deposits, withdrawals, contract and tender posts, share issues, listings
  and purchases, dividends, fund trades and decisions take a client `requestId`; the key lands on a unique column
  (`ExchangeTransaction`, `ConversionLog`, `VaultTransaction`, `Contract`, `ShareListing`, `CompanyDividend`), or for a
  decision on the one pending decision a company may have. A retry
  returns the first result; a racing duplicate loses on the unique index and its whole transaction rolls back.
- **Row locks:** share trades, dividends, decisions, withdrawals, deposits and dissolution lock the company row first,
  then wallets in user-id order, so they serialise per company and don't deadlock each other; fund trades and the index
  run lock the sector rows.
- **Caps:** daily conversion cap, out allowance, company cap, open-contract cap, bids ≤ value, an issue at most doubles
  the shares (1,000,000 at most), 5 open listings per holder per company, config values clamped.
- **Rate limits:** every mutation is `rateLimitedMutationProcedure` (per procedure, per user); admin ones `adminProcedure`.
- **Audit log:** every ₷ move is an `ExchangeTransaction` row with `balanceAfter` and metadata; every conversion a
  `ConversionLog` row; admin calls go through `adminProcedure`'s audit middleware, and balance adjustments record the
  admin and reason in the ledger metadata.

## 6. Flags and admin

`isExchangeEnabled` sits with the other vault flags (`vault_isExchangeEnabled`, admin: Vault and economy → System
config). It defaults **on**: conversion in is a sink, conversion out is bounded by what went in, charters are a sink and
contracts only move ₷ between players. It gates conversion, companies and contracts, never MyClub's ₷ spending. The
**Exchange** admin tab edits rate, fee, daily cap, charter fee, company cap, starting balance and the contract revenue
share and hold (§8.5), lists disputes, and adjusts ₷ balances (a debit never overdraws).

## 7. Schema (additive)

`ExchangeTransaction.idempotencyKey` and `ConversionLog.idempotencyKey` (nullable, unique); `Contract` gains
`issuerCompanyId` (relation `ContractIssuer`), `issuerUserId`, `description`, `escrow`, `awardedBidId`, `disputeReason`,
`disputedByUserId`, `resolutionNote`, `closedIxTime`, `idempotencyKey` (unique), `updatedAt`, plus indexes; two
`VaultTransactionType` values, `SPEND_EXCHANGE` and `EARN_EXCHANGE`.

Phase 2 (also additive): `Company.tradingOpen` (default false) and `Company.decisionValue`; `Contract.issuerCountryId`,
`Contract.fundedBy` and a `(status, endIxTime)` index; `SectorIndex.fundSovereigns` and `SectorIndex.unitsOutstanding`;
new tables `exchange_share_listings` (`ShareListing`) and `exchange_company_dividends` (`CompanyDividend`). All 13
original Exchange models are now in use.

## 8. Phase 2 (built 2026-10-06)

- [x] **8.1 Share trading:** fixed-price listings, no order book (`lib/exchange/shares.ts`). A **primary** issue is the
      founder selling new shares at fair value per share (fair value ÷ shares outstanding, rounded down to a cent);
      proceeds go to capital, at most one open issue, an issue at most doubles the shares. A **secondary** listing is a
      holder selling their own shares at a price they choose; the shares are escrowed out of their holding until sold
      or cancelled. Buyers take any part of a listing (`SHARE_BUY`/`SHARE_SELL`). Founder controls: trading on/off
      (`tradingOpen`, off at charter; closed trading blocks new listings and purchases, never cancellations), issuing,
      cancelling the issue, dividends. No order matching, no shorting, no margin.
- [x] **8.2 Dividends** (`dividends.ts`): the founder pays part of capital pro rata to every holder (listed shares
      count); each payout rounds down to a cent and capital drops by exactly the sum paid, the remainder stays in
      capital. A `CompanyDividend` row (unique key) makes a retry pay once.
- [x] **8.3 Sector indices and funds** (`sectors.ts`, job `exchange-market` every 6 hours): each index is computed from
      Exchange activity in its sector (capital and positive standing of ACTIVE companies, plus contracts completed in
      the last 30 days), relative to the activity captured on the first run, with a 10,000 ₷ floor, and moves at most
      5% per run; every run writes `SectorIndexHistory`. **Not from `SectoralOutput`:** those rows are owner-edited
      modelling data, sparse and easy to swing, while Exchange activity costs ₷ to move. `SectorPosition` holds units
      of a **sector fund**: buy at the unit price (fund ₷ ÷ units), sell back at it; after each run the four funds are
      rebalanced by relative index growth, keeping the total exact to the cent. No ₷ is created, so moving an index
      can only shift ₷ between fund holders; a sale waits 24 hours after the seller's last buy in that sector. No
      leverage. Fair value now uses the `valuation*` weights (§3).
- [x] **8.4 B2G tenders** (`createGovernmentContract`): a nation's owner (or the player acting as it) posts a tender
      funded from **their own wallet**, since nations hold no ₷ treasury; refunds go back there. Companies bid as on
      B2B contracts; a winner in the tender's own sector earns +2 standing instead of +1 (the sector-matched bonus,
      standing only, no ₷). Not built: admin- or sim-issued tenders as a ₷ faucet, which would mint ₷ and needs its own
      budget and cap.
- [x] **8.5 Relaxed out allowance:** `exchange_revenue_convertible_share` (default 0.5) of what a player's companies
      were paid on contracts completed at least `exchange_revenue_hold_days` (default 7) ago counts toward the
      convert-out allowance. Residual risk: two colluding accounts can move IxC between them through contracts; each
      round trip loses the 5% fees both ways plus the unconverted share, and the daily cap still applies. Set the share
      to 0 to turn it off.
- [x] **8.6 Expiry job** (`expiry.ts`, job `exchange-contract-expiry` every 15 minutes): cancels OPEN contracts never
      awarded within 3 days of bidding closing and refunds escrow; one conditional transition per contract, keyed
      refunds, so re-runs and overlapping runs refund once.
- [x] **8.7 Notifications** (`notify.ts`): bids (issuer), awards (winner, and losing bidders at low priority),
      completions, releases, disputes and their decisions (both parties), expiries, share sales, dividends and applied
      decisions, through `notificationAPI` as "economic" notices, so the recipient's preferences apply. Sent after the
      transaction commits; a failure never undoes a move.
- [x] **8.8 Company decisions** (`decisions.ts`, applied by `exchange-market` a real day after queuing): one pending
      per company, cost paid from capital at once (burned). `EXPAND` (100 to 1,000,000 ₷) adds its cost to
      `decisionValue` (fair value); `ENTER_SECTOR` (500 ₷) moves the company to another sector.

### Still not built

- [ ] `RND`, `ACQUIRE`, `LOBBY` and `PRICE` decisions: each needs a mechanic the Exchange lacks (research, mergers, policy
      hooks, pricing).
- [ ] Admin- or sim-issued tenders (a controlled ₷ faucet) and a nation ₷ treasury.
- [ ] An order book or limit orders for shares; voting shares.
- [ ] An admin control for `SectorIndex.dmModifier` (the formula honours it; nothing sets it yet).
