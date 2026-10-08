# IxnayID Passport

**Last updated:** 2026-10-05

**Routes:** `/@user`, `/id/[username]`, `/r/[realm]/@user` (rewrites to `/r/[realm]/u/[username]`; the old `/r/[realm]/[username]` 301s) | **Module:** `src/server/modules/identity/` | **Router:** `api.ixnayid` (`src/server/api/routers/ixnayid/`) | **UI:** `src/components/passport/`

The passport is the public face of an IxnayID account. It is readable signed-out; the viewer's id only decides ownership (the Edit Passport control and the settings on the back face).

---

## Tabs

| Tab      | Procedure               | Contents                                                                       |
| -------- | ----------------------- | ------------------------------------------------------------------------------ |
| Overview | `getPassport`           | Featured realm, the **showcase** (below), platform affiliations, civic stature |
| Realms   | `getRealms`             | Every realm membership and claimed country                                     |
| Work     | `getWork`               | WikiOS pages and activity, Onoma languages, MyLeague clubs, directives         |
| Vault    | `getPassport` (`vault`) | Collector level, deck value, the most valuable cards                           |
| History  | `getHistory`            | Cross-platform activity stream, paged                                          |

The front face also carries a stat row (Lorewards, Focus, Forum, IxCredits) and the owner's signature inscription.
The photo wears the holder's equipped Vault glow and frame and the name carries their badge, for every visitor
(`PassportPortrait`, `vault.getEquippedCosmeticsFor`; equipping is the opt-in, there is no separate toggle).

---

## Showcase

Shown on the Overview tab (`components/passport/showcase/PassportShowcase.tsx`). Real data only; each panel has an empty state, and a "kept private" state when the owner hides it.

- **Achievements & ribbons** (`showcase.achievements`): unlocked count out of the active catalogue, total points, the **signature shelf** (the owner's pinned ribbons, or their three rarest when none are pinned), the full **ribbon rack**, and the next few achievements by rarity. Loaded by `loadAchievementsShowcase` (`identity.showcase.ts`) from `UserAchievement` rows keyed by the owner's Clerk id. How ribbons are derived and styled: [Achievements → Ribbons](./achievements.md#ribbons).
- **Collection highlight** (`vault.topCards`): the three most valuable live cards (highest `Card.marketValue` first). The Vault tab shows the top six.
- **Lorewards standing** (`wiki.lorewards`): rank, score, laurels and best streak.

`vault.focus` counts distinct lore categories across the whole live collection (NationStates imports excluded) out of the 12 lore categories, and names the largest.

---

## Privacy settings

The owner flips the passport (Edit Passport) to change settings. Every change is saved to the owner's `PassportPreference` row (`prisma/schema/identity.prisma`, one row per `User.id`; no row means the defaults). All sections default to shown.

| Toggle (UI key)                    | Column             | What the server strips when off                                                                                       |
| ---------------------------------- | ------------------ | --------------------------------------------------------------------------------------------------------------------- |
| Achievements (`achievements`)      | `showAchievements` | `showcase.achievements`; `getRibbons` and `getCountryRibbons` return nothing, so the country-page rack disappears too |
| Civic Accolades (`accolades`)      | `showLorewards`    | `wiki.lorewards`, `wiki.awardHistory`, and Lorewards laurels in the Work and History feeds                            |
| Focus (`impact`)                   | `showFocus`        | `vault.focus`                                                                                                         |
| Forum Discussions (`forumStats`)   | `showForumStats`   | `forum.stats` (title, messages, reactions, trophy points)                                                             |
| IxCredits (`vaultCards`)           | `showVault`        | the whole `vault` (credits balance and collection)                                                                    |
| Activity History (`historyStream`) | `showHistory`      | `getHistory` returns an empty page                                                                                    |

Enforcement is server-side: `getPassport` skips loading hidden sections and passes the rest through `redactPassportSections` (`identity.privacy.ts`), so hidden data never reaches the response. Hidden sections are hidden from **every** viewer, the owner included, so the owner sees what visitors see. The payload's `privacy` object says which sections are shown, so the UI can explain an absent section.

The back face also saves:

- **Signature inscription** (`signature`, up to 60 characters; blank falls back to the display name), saved on Done.
- **Signature ribbons** (`pinnedRibbonKeys`, up to 3). The server keeps only keys of achievements the owner has unlocked.

### Procedures

| Procedure                        | Kind                                  | Purpose                                                     |
| -------------------------------- | ------------------------------------- | ----------------------------------------------------------- |
| `ixnayid.getPassport`            | public query                          | Passport payload with hidden sections removed               |
| `ixnayid.getRibbons`             | public query                          | Every ribbon of a passport holder                           |
| `ixnayid.getCountryRibbons`      | public query                          | A country owner's top 3 ribbons and total                   |
| `ixnayid.getPassportSettings`    | protected query                       | The signed-in user's settings and every ribbon they can pin |
| `ixnayid.updatePassportSettings` | protected mutation (light rate limit) | Save visibility, signature and pins                         |

---

## Known gaps

- `getRealms` and `getWork` are not governed by any toggle (realm memberships and published work are always public).
- Pins cover ribbons only; cards in the collection highlight are chosen by value, not by the owner.
- The OOC community ribbons from the [ribbons spec](../specs/2026-08-10-achievements-ribbons-design.md) are not built.

## Related

- [Achievements](./achievements.md)
- [Vault](./myvault.md)
- [API Reference](../reference/api-complete.md)
