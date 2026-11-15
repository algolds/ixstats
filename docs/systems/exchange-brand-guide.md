# Exchange brand guide

**Last updated:** 2026-11-07 · **Route:** `/exchange` · **Design spec:**
[specs/2026-11-06-exchange-overhaul-design.md](../specs/2026-11-06-exchange-overhaul-design.md) · **System:**
[exchange.md](exchange.md)

The Exchange is IxStates' market terminal: Bloomberg for seeing every move in the realm's economy, Robinhood for
acting on it in a tap or two. Its look takes Chase's banking app as the base (owner, 2026-11-06). This guide records
what makes it the Exchange, and what stays standard Facet.

## Name

**Exchange**, in sentence case, everywhere. Never "IxExchange" or "the Exchange app". The currency is the **Sovereign**,
written **₷** before the figure (`₷1,284.62`).

## Colour

| Mode | Tint | Strong | On tint |
|---|---|---|---|
| Light | `#0F70BB` | `#0B5EA8` | `#FFFFFF` |
| Dark | `#5EA6EE` | `#8BBFF2` | `#0B0C0F` |

- These blues are tuned from Chase's `#117ACA`: the light one meets AA contrast on white, and the dark one clears the
  Maps tint by 30°.
- The Exchange and Wiki pair is the one exception to the 30° hue rule (`app-palette.test.ts`). The Exchange blue is
  bright and the Wiki navy deep, so the two differ by lightness.
- Gains and losses use the system success and destructive colours, never the tint.
- Onoma's scoped azure (`#0066B8` / `#0091FF`) sits near this blue. Onoma's mark and glyphs keep the two apart.

## Wordmark

`ExchangeWordmark` (`src/components/exchange/terminal/brand.tsx`): the word "Exchange" in the app tint, bold, with
tight tracking, at title-2 size. It heads every Exchange page and links to the front page.

## Figures

- Every number is tabular.
- A page's one headline number uses `Figure size="hero"`: large title on phones, display size from `sm` up, bold.
  Examples are the realm index, a price or a portfolio's total.
- Changes use `ChangeLabel`:
  - `+1.2%` or `−0.7%`, with a true minus sign (U+2212);
  - `·` when there is nothing to compare;
  - success and destructive colours, never the tint.

## Pills

- The main action on a page is a `Pill`: a rounded-full button filled with the tint.
- Filters and time ranges are `SegmentedControl`s.
- A page has at most one tinted pill, such as "Buy or sell", "Trade" or "Issue bonds".

## Voice

- Numbers first, plain words, short headlines: "Caphiria issues ₷10,000 in 4-week bonds at 5%".
- Never a username:
  - companies and nations by name;
  - a player as "a private investor" until identities land;
  - an investor on a board as "Investor #n".
- No eyebrows, uppercase labels, emoji or em dashes (Facet section 9).

## Not Chase's

The Exchange uses none of Chase's marks: no octagon, no wordmark, no name. It takes the feel: one confident blue, white
space, big friendly figures, rounded actions.

## What stays Facet

Layers, content types (`visualization` for charts, `feed` for news, `data` for lists, `input` for forms), semantic
tokens, Radix through `components/ui` only, iconoir icons, and the zero-tell lock on `src/components/exchange`. The
brand exception is recorded in [facet-design-system.md](../reference/facet-design-system.md) (Facet exceptions,
item 5).
