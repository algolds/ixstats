# The Exchange overhaul: the IxStates market terminal

**Last updated:** 2026-11-06 · **Status:** Draft for owner review. Decided with the owner on 2026-11-06. It changes
three earlier documents:

- the UI parts of [2026-11-01-exchange-phase-3-design.md](2026-11-01-exchange-phase-3-design.md) (§6), and its
  decision suite (§5.1);
- the "founder first" emphasis of the 2026-10-30 direction;
- [systems/exchange.md](../systems/exchange.md), which is to be updated when this ships.

## 1. Intent

Opening the Exchange should feel like opening the IxStates **Bloomberg terminal and Robinhood** in one. It is
Bloomberg in that you see every in-world trade and economic move in your realm. It is Robinhood in that acting on
what you see is easy and friendly.

The stock market is one system inside it, not the whole thing. The Exchange is the economy loop turned into
gameplay: a sandbox where players, alone or together, make moves that push some of the larger economy stats. Those
pushes are small, capped and logged, as before. Players don't need to charter a company to take part: most will
watch, some will invest, and a nation's owner can act as that nation's treasury.

Today the engine is deep: per-tick P&L, credit, bankruptcy, an order book, shareholder votes, nation treasuries,
tariffs and wiki-linked companies. The screen in front of it is a generic dashboard. This overhaul gives the engine
a product to match.

## 2. Audit: where it stands (2026-11-06, rose-garden `967a5cf39`)

| # | Finding | Evidence |
|---|---|---|
| A1 | One page, a title, four stat tiles, five in-page tabs and a fixed inspector. It reads as a Facet template, not a product. | `src/components/exchange/ExchangeSection.tsx` |
| A2 | No identity. MyLeague has covers, crests, scoreboards and commentary. Onoma has a lockup, glyphs and a brand guide. A company here is a name in a list row: no logo on the board, no ticker, no chart, no page of its own. | `src/components/sports/*`, `src/app/labs/onoma/*`, `docs/systems/onoma-brand-guide.md` |
| A3 | Nothing has an address. Tab, realm and selected company live in `useState`, so nothing can be linked or bookmarked. Every notification lands on the bare page (`EXCHANGE_HREF = "/labs/exchange"`). | `ExchangeSection.tsx:156`, `src/lib/exchange/notify.ts:21` |
| A4 | The layout leads with what the 2026-10-30 direction demoted. Wallet and portfolio tiles come first, and the order book is a top-level tab. | `ExchangeSection.tsx:83-149`, `:276` |
| A5 | Money math is copied into the UI. `computeFairValue`, `creditLimitFor` and `borrowRateOf` exist in both `src/components/exchange/shared.tsx` and `src/lib/exchange/`, so the screen can drift from the server. | `shared.tsx:283-315`, `companies.ts:75`, `credit.ts:60` |
| A6 | Very little visualisation. One hand-drawn sector line. The inspector has no price or value chart, although `CompanyValueHistory` is recorded on every change and tick. | `SectorsCard.tsx:28`, `exchange.prisma` |
| A7 | The market is empty. The local copy (production data) holds 1 company, 4 wallets and 0 contracts. A terminal over that shows nothing. | local `exchange_*` counts |
| A8 | In-page destination tabs break the 2026-10-28 ruling that destinations live in the sidebar. | `ExchangeSection.tsx:273-279` |
| A9 | The engine itself is sound and well tested: 20 test files, conditional decrements, idempotency keys, row-lock order. The overhaul keeps it. | `src/tests/lib/exchange/`, `docs/specs/2026-10-06-exchange-economy-design.md` §5 |

## 3. Goals, non-goals, anti-goals

**Goals**
- A top-level app, **Exchange**, with its own brand, colour and sidebar sections.
- A front page that shows the realm's market and its business news at a glance.
- Every company, bond, nation and story has a page with its own address.
- Watching is fun on its own (watchlist, alerts, nation pages, leaderboards). Acting takes a tap or two.
- Every move is credited to an in-world identity, so the feed reads as lore.
- Nation treasuries become players: bonds, a sovereign wealth fund, lending terms and tenders.

**Non-goals**
- No simulation-run or seeded companies. Only players charter companies (owner, 2026-11-06).
- No change to the ₷ / IxCredits separation. There is no conversion either way.
- No new MyCountry coupling beyond the existing caps (GDP level −2% to +5%, economic vitality −5 to +10).
- No delegation of the treasury role. Only the nation's owner acts as its treasury.

**Anti-goals** (failure even if it works)
- It looks like a Facet template again: stat tiles, eyebrows, uppercase labels, emoji.
- It copies Chase's logo, octagon or wordmark. The look is Chase-inspired, not Chase.
- The feed shows usernames instead of in-world identities.
- A treasurer can enrich their own companies with state money.
- Money math in the UI differs from the server's.

## 4. Owner decisions (2026-11-06)

| Topic | Decision |
|---|---|
| First screen | Layout **B, "Front page"**: a big realm index chart with today's move, **Today in business** as the main column, and a narrow column with sectors, movers, nation bonds and live activity. Nothing on it asks you to act. |
| Default player | Mostly watches. |
| Who fills the market | **Players only.** |
| Day one | **Nation bonds are on the board** from the start, so a new realm's board is never empty. |
| Treasury powers | All four: post tenders, sovereign wealth fund, government bonds, lending terms for domestic companies. |
| Treasury guardrails | All four: a stake cap per company, no self-dealing, public holdings, owner only. |
| Bond rate | The **treasurer sets the coupon** at issue; after that the market prices the bond. |
| Bond default | **A default has consequences**: rating drop, pro-rata payment, front-page news, an issuance ban. |
| Identity | **ThinkPages accounts.** Citizen means investor, corporate means a company's face, government means the treasury (owner only), media means the press. The first visit auto-creates a citizen account in your active nation. |
| Money per identity | **Each identity has its own money.** Citizen pays from the personal ₷ wallet, government from the nation's treasury, corporate from the company's capital. |
| News sources | All four: engine events, MyCountry policy changes, media accounts, press releases. |
| Kept | B2B contracts, shareholder votes, sector index funds. |
| Company decisions | **Cut to a few**: one **Invest** action (Expand and R&D merged) and **Acquire**. Lobby, Pricing and Enter sector go. |
| Home | **Its own app** at **`/exchange`**, with `/labs/exchange` redirecting there. It leaves Labs. |
| Navigation | **Sidebar sections.** No in-page tabs. |
| Brand | The name stays **"Exchange"**, with a full brand: wordmark, number typography and a brand guide in `docs/systems/`. |
| Look | **Chase as the base**, and the mockup is approved: white canvas, one confident blue, big friendly figures, pill buttons and filters, generous spacing, a bold wordmark. |
| Colour | Chase-style blue: **#0F70BB light, #5EA6EE dark**. These are tuned from Chase's #117ACA so the light blue passes AA on white and the dark blue clears Maps by 30°. Exchange and Wiki get **one named exception** to the 30° hue rule; they differ by lightness and saturation instead. |
| Watching | Watchlist, alerts, nation pages, leaderboards. |
| Currency | **₷ settles everything**: one wallet, MyClub unchanged, the same money-safety rules. Nation pages and bonds also **show the nation's own currency**: its MyCountry name and symbol, plus a ₷ rate where `currencyExchangeRate` is set (16 of 280 nations today). That is display only; there is no FX system. |
| Access | **Signed-out visitors can watch**: the front page, Markets and object pages are public and read-only. Every action needs sign-in. The admin kill switch `isExchangeEnabled` still closes trading. |
| Release order | **Watch first.** R1: app, brand, front page, Markets, company and nation pages, engine and policy headlines, Portfolio, simple trading, **and basic nation bonds** (issue, buy, coupons, default), so the board is never empty. R2: the rest of the treasury powers (wealth fund, lending terms), press releases and media articles. R3: identities everywhere and removal of the cut parts. |
| Player names before R3 | A player who trades shows as **"a private investor"** until identities land. Companies and nations show by name. Never a username. |

## 5. The product

### 5.1 App, brand and colour

- The app is public for watching: signed-out visitors get the read-only pages, and every mutation stays behind sign-in, rate limits and `isExchangeEnabled`. The Labs gate no longer applies.
- New app id **`exchange`** in `APP_IDS` (`src/lib/design/tokens.ts`) and in the sidebar (`src/lib/navigation/app-sections.ts`). It is removed from the Labs sections.
- `APP_TINTS.exchange`: tint #0F70BB (light) and #5EA6EE (dark), each with a `strong` and an `onTint`.
  - #117ACA is 4.51:1 on white, at the AA edge. Darken it slightly if `token-contrast.test.ts` fails on any background role (tint on background must be ≥ 4.5:1, tint on other roles ≥ 3:1).
  - `app-palette.test.ts` gets one explicit, commented exception for the `exchange`/`wiki` pair. Every other pair keeps the 30° rule.
- Brand pieces, recorded in a new `docs/systems/exchange-brand-guide.md`:
  - the **Exchange wordmark**, a bold sans with tight tracking;
  - a **number style** for figures: tabular, large and heavy for headline figures, with gains and losses in the system success and destructive colours;
  - the **pill** shape for buttons, filters and time ranges;
  - an app icon in the Facet icon family (a solid iconoir mark with a cut-out).
- *My call:* the brand elements (wordmark, pills, headline figures) go into the Facet spec as a scoped Exchange exception, as WikiOS has. Everything else stays standard Facet: layers, content types, zero tells, semantic tokens. `src/components/exchange` stays in the zero-tell directories.

### 5.2 Sidebar sections

```
Exchange
  Front page      realm index, Today in business, sectors, movers, nation bonds, live activity
  Markets         companies, nation bonds, index funds (filters, search, watchlist stars)
  Tenders         open, awarded and delivered tenders and B2B contracts
  Portfolio       holdings, open orders, watchlist, votes owed, alerts
  ─────────
  Treasury        nation owners only (R2)
  My companies    founders only
```

Each object has its own page below these sections:
- a **company** page (ticker, price and value chart, key figures, P&L, rating, shareholders, filings, governance, wiki lore, trade sheet, full order book as an advanced view);
- a **bond** page (coupon, maturity, price and yield chart, the nation's rating, holders);
- a **nation** page (bonds, treasury, wealth fund holdings, domiciled companies, tax and tariff moves, tenders);
- a **story** page (the article and the market move it caused).

*My calls:*
- The realm is a query parameter (`?realm=`), defaulting to the realm of your active nation.
- Routes are `/exchange`, `/exchange/markets`, `/exchange/tenders`, `/exchange/portfolio`, `/exchange/treasury`, `/exchange/companies`, plus object pages under `/exchange/c/[id]`, `/exchange/b/[id]`, `/exchange/n/[id]` and `/exchange/s/[id]`, all by id because `Company` has no slug. A Leaderboards section sits beside the six.
- Use the single-page router pattern (as `CardsHub`), with section state derived from the path.
- `notify.ts` links go to the object's page.

### 5.3 Front page

As approved in mockup B (`.superpowers/brainstorm/*/content/chase-direction.html`):
- **Realm index chart:** today's change, and 1D / 1W / 1M / All ranges.
- **Today in business:** each story shows its source identity and age, and the move it caused when there is one (for example "Caphirian Steel +4.8% on the news").
- **Side column:** sectors, movers, nation bonds (yields), and live activity (trades, tender wins, treasury moves, credited to in-world identities).
- **Header:** the realm switcher and one "Buy or sell" pill that opens search.

*My call:* the realm index combines the four sector indices, weighted by the realm's GDP sector weights (`macro.ts`). The nation bonds board sits beside it as its own list.

### 5.4 Trading (the Robinhood part)

- Trading starts from a company, bond or fund page, or from search.
- The trade sheet asks for an amount and Buy or Sell, shows the estimated price, fee and tax, and confirms.
- Underneath, it uses the existing order book.
  - A buy fills against the best asks at once. Any rest stays as a limit order at the price the player saw.
  - A sell lists against the best bids.
- The full depth book and limit-price entry live in an "Advanced" view on the same page.

## 6. Identities and money

- You act as one of your ThinkPages accounts (`ThinkpagesAccount.accountType`):

  | Account | What it can do | Whose money moves |
  |---|---|---|
  | `citizen` or `personal` | Invest: shares, bonds, funds | Your personal ₷ wallet. All your citizen and personal accounts share it. *My call.* |
  | `corporate` | Company actions | That company's capital |
  | `government` | Treasury powers | That nation's ₷ treasury. Only when you own the nation. |
  | `media` | Writes business news | None |

- On the first visit, a citizen account is created in your active nation if you have none.
- An identity switcher sits in the Exchange header. *My call:* it is shown only when you hold more than one usable identity.
- Founding a company still requires a nation: the company's domicile is the founder's active nation, unchanged.
- Every ledger row, activity item and news item records the acting account id. The UI shows the account's display name and avatar, never the username.

## 7. Instruments

- **Company shares.** As now: the two-sided order book, dividends, cap-gains tax and governance.
- **Nation bonds (new).**
  - The treasurer issues a bond: amount, coupon and maturity.
  - Coupons are paid from the nation's treasury each market tick, pro rata. Principal is repaid at maturity.
  - Bonds trade on the same order-book machinery as shares, generalised to an instrument.
  - Each nation gets a credit rating, derived from treasury health and its MyCountry economy (growth, debt, government efficiency).
  - An untraded bond shows a model price from its coupon against the rating-implied yield.
  - **Default:** when a coupon or principal falls due and the treasury can't cover it:
    - holders are paid pro rata from what the treasury has;
    - the bond and the nation go to rating D;
    - the default becomes a front-page story;
    - the nation can't issue new bonds for a ban period.
  - *My calls:*
    - maturity from 1 to 12 weeks, with coupons paid weekly. Years of real or realm time are too long to play; the R1 plan settled this.
    - outstanding principal per nation capped at a multiple of the treasury cap;
    - the ban period is 30 real days.
  - A bond is issued, priced and paid in ₷. Its page also shows the nation's own currency name, plus the ₷ rate when MyCountry has one.
- **Sector index funds.** Kept as they are, as the low-effort option.
- **Tenders and B2B contracts.** Kept as they are. They move to the Tenders section, and awards feed the news.

## 8. Treasury powers and guardrails (R2)

- **Tenders:** as now (`createTreasuryTender`).
- **Sovereign wealth fund:** the treasury buys and sells shares, index funds and other nations' bonds, never its own. *My call* on the scope.
- **Bonds:** issue and repay (§7).
- **Lending terms:** the treasurer sets the spread over the nation's MyCountry interest rate and a per-company credit cap for domestic companies. Credit lines stay automatic within those terms; there is no approval queue. *My call.*
- **Guardrails:**
  - **Stake cap:** a treasury holds at most **25%** of any company. *My call* on the number.
  - **No self-dealing:** a treasury can't buy shares of, lend to or award a tender to a company the owner founded or holds shares in. Enforce it at the domain layer, inside the same transaction as the move.
  - **Public:** every holding, trade, loan, bond issue and tender is visible on the nation's page and in live activity.
  - **Owner only:** the government identity is available only to the nation's owner.

## 9. News

Every news item is a row with these fields: realm, kind, source identity, headline, optional body, the subjects it is
about (company, bond, nation, tender), and the market move it caused.

- **Engine events:** templated headlines, not AI-written, from what the engine already records:
  - tender awarded and delivered
  - dividend declared
  - distress, bankruptcy and acquisition
  - vote passed
  - bond issued, defaulted or repaid
  - large trades
- **Policy:** templated headlines when a nation changes its corporate or cap-gains tax, a sector tariff, its interest rate or a trade treaty.
  - *My call:* the market tick detects these by comparing each nation's figures with the snapshot stored on the previous tick. The Exchange only reads MyCountry; it doesn't hook into MyCountry's write paths. Domain modules may not import each other.
- **Media articles and press releases:** ThinkPages posts tagged as business, by media, corporate or government accounts.
  - *My call:* this is one mechanism for both. A press release is a business-tagged post by a corporate or government account.

## 10. What goes

- **The current UI:** `ExchangeSection`'s tabs, the KPI strip and the fixed `CompanyInspector`. The existing cards are reused only where they fit the new pages.
- **Decisions:** Lobby, Pricing and Enter sector are removed. Pending decisions of those types are refunded on deploy. `pricingStrategy` is treated as balanced.
  - Expand and R&D merge into one **Invest** decision. *My call:* it keeps R&D's efficiency yield (1.15× to plant, +1 standing) and drops the breakthrough roll.
  - Acquire stays.
- **Duplicated money math in `shared.tsx`:** the pure functions move to a module both the UI and the server import.
- **The Labs entry for Exchange.**

## 11. MyCountry

- The Corporations tab, `EconomyRail` insights and the agenda items stay, and link into `/exchange`.
- The coupling caps are unchanged.
- Bonds and the wealth fund change only the ₷ treasury, never MyCountry's budget figures.

## 11a. Release 2 decisions (owner, 2026-11-07) and how they are built

**Owner decisions:**
- **The press route is the `#business` hashtag.** A public ThinkPages post tagged `#business` by a media, government
  or linked corporate account appears in its realm's Today in business, as an excerpt that links to the post.
- **Companies get a voice now.** In My companies, a founder links one of their corporate ThinkPages accounts to their
  company. That account's `#business` posts are the company's press releases, shown on the company page.
- **The wealth fund is capped at half the treasury.** Fund cash plus holdings at cost may not exceed 50% of the
  treasury's balance plus the fund. This comes on top of the 25% stake cap per company.
- **A story follows its post.** Delete or hide the post and the story leaves the Exchange. ThinkPages moderation is the
  only moderation.

*My calls, for the builder:*
- **The fund is an account.** Each nation's wealth fund is a fund account: a system user and wallet per nation
  (`NationTreasury.fundUserId`). It trades through the existing order book, bond and fund engine, unchanged.
  - The treasurer moves ₷ between the treasury and the fund (deposit and withdraw). The 50% cap is checked on deposit.
  - Dividends, coupons and sales land in the fund.
  - The fund account is left out of leaderboards and notifications. Its holdings are public on the nation page.
- **What the fund may not buy:**
  - its own nation's bonds;
  - a company the nation's insiders (`ownerUserId` or `User.countryId`) founded, hold shares in, or have listed;
  - more than 25% of any company, counting its holdings, listed shares and open buy orders.
- **What the fund may not sell or fill (owner ruling 2026-11-09):**
  - share or bond listings outside ±20% of fair value (shares: fair value per share; bonds: face value);
  - any fill between the fund and its own nation's insiders (`ownerUserId` or `User.countryId`), refused on explicit takes and skipped when crossing the order book or choosing the cheapest bond listing;
  - concurrent fund orders for the same nation are serialized under a per-nation lease (`exchange-fund:<countryId>`) so racing orders can't both pass the stake cap.
- **No self-dealing in tenders either.** A nation's treasury also won't award its tenders to a company the nation's
  insiders founded, hold shares in, or have listed.
- A nation's owner (or anyone acting as the nation) may not buy its bonds, primary or secondary (owner ruling 2026-11-09).
- **Lending is exempt (owner, 2026-11-07).** Companies live in their founder's own nation, so a strict rule would leave
  almost no company able to borrow. Credit lines stay open to the owner's own companies, because the terms are published
  and the same for every domestic company. The rule covers the discretionary moves only: wealth-fund buys and tender
  awards.
- **Lending terms** sit on `NationTreasury`:
  - `lendingSpread`, from −2 to +10 percentage points, is added to the rating spread;
  - `companyCreditCap`, from ₷0 to ₷250,000, caps each domestic company's line.
  - The defaults (0 and ₷250,000) keep today's behaviour. Borrowing, the tick's interest and its credit-limit check
    all use them.
- **Which posts become stories:**
  - The post must be public, top-level (no replies or reposts) and carry no content warning.
  - It must come from an active account.
  - The tag matches case-insensitively.
  - Stories are read live from ThinkPages (no copy), so a deleted or hidden post drops out on its own.
  - Press stories get no watcher alerts in R2.
- **Account links** are one-to-one: one corporate account per company, one company per account. The account must
  belong to the founder.
- **Trading as the treasury:** the trade sheet gets a "Trade as" switch (you, or your nation's treasury) when the
  viewer owns a nation in the realm.
- **The realm DM lever** (sector modifiers) returns on Markets, Funds, for realm managers.
- **The Treasury section** becomes overview, wealth fund, bonds and lending terms. Posting a tender stays on Tenders,
  which already funds tenders from the treasury.

## 12. Releases

- **R1, Watch.**
  - App id, tint and palette exception, brand guide, sidebar sections, `/exchange` and its redirect.
  - Public read-only pages for signed-out visitors.
  - Front page, Markets (companies, funds and bonds), company, bond and nation pages, story pages.
  - Basic nation bonds and ratings (§7): issue, buy, sell, coupons, default.
    - A nation owner issues from a minimal Treasury section.
  - Engine and policy headlines.
  - Portfolio with watchlist and alerts, leaderboards, the trade sheet.
  - Pure money math shared with the server, and notification links.
  - Players show as "a private investor" in activity.
- **R2, Treasury.**
  - The wealth fund, lending terms, guardrails (§8).
  - Media articles and press releases.
  - The full Treasury section.
- **R3, Identity.**
  - Acting as ThinkPages accounts everywhere, the identity switcher, attribution on every row.
  - Removal of the cut decisions.
  - The `systems/exchange.md` rewrite.

## 13. Constraints

- **Facet:** layers, content types and zero tells, apart from the scoped brand exception in §5.1. Feature code never imports Radix directly. Icons come from iconoir.
- **State:** at most 5 `useState` per file (the ratchet). State the URL or server already holds is derived from them. The React Compiler is on, so no new `useMemo` or `useCallback`.
- **Money:** every ₷ move keeps the existing rules:
  - conditional decrements;
  - idempotency keys;
  - the lock order: company row, then wallets by user id, then treasury rows;
  - one ledger row per move.

  Treasury moves use the `NationTreasuryEntry` ledger.
- **Architecture:** routers stay thin. Logic lives in `src/lib/exchange/` and modules don't import each other. Realm time comes from `~/server/shared/realm-time`.
- **Database:** schema changes are additive SQL run before `db push`, listed in `deploy-production.sh` with an idempotency test, following the existing pattern.
- **Gates:** typecheck partitions, Jest, oxlint, `docs:check`. No local builds.

## 14. Left to the builder

- The visual detail of each page beyond the approved front page, within §5.1's brand.
- The bond pricing model, coupon schedule mechanics and the rating formula, within §7's rules.
- Leaderboard metrics and their periods.
- Alert thresholds.
- The data model for news items, watchlists, bonds and identity attribution.
- How the order book is generalised from shares to instruments.
