# Action-Linked Posts and Story Chains (shared module)

**Date:** 2026-10-07
**Status:** Approved design, awaiting spec review
**Used by:** [Concept A: Lean IxForum](2026-10-07-forum-concept-a-lean-xenforo-design.md) and [Concept B: ThinkPages as the forum](2026-10-07-forum-concept-b-thinkpages-forum-design.md)
**Origin:** Kistan (Keaor) and Heku discussion of the town square, 2026-10-07

## Goal

Let a player prove, inside a forum post, that they actually did the mechanical thing they are roleplaying, and let a run of those posts become a reviewed story chain that unlocks achievements and lands in wiki history.

Kistan's framing: plan in the realm forum, act mechanically, then flavour the action back in the forum. Plain RP stays possible but has no mechanical effect.

## Scope

In v1:

- Embed one of your own country's logged actions in a post as a live card with a verified badge.
- Group linked posts into a story chain, submit it, have it reviewed.
- On approval: grant chain achievements, append the chain to a wiki page.

Out of v1:

- Credit (IxVault) rewards.
- Linking other countries' actions.
- Chains spanning several countries.
- Any new ranking score or leaderboard (points come from the existing `Achievement.points`).

## Embedding

Token syntax, the same on both platforms:

```
[ixaction=<ActivityFeed.id>]
```

- **Source of linkable actions:** any `ActivityFeed` row whose `countryId` is the poster's country. Directives, operations and diplomatic moves already log there, so no per-system adapters.
- **Picker:** an "Attach action" button in the composer lists the user's country's recent `ActivityFeed` entries and inserts the token.
- **Rendering:** the token renders as an action card (title, `type`, IxTime date, country flag and name, verified badge). Unknown or foreign IDs render as plain text "unverified action".
- **Verification:** on submit (create and edit), the server parses all tokens and rejects the post if any token references an activity not owned by the poster's country. Ownership at write time is the verification.

## Data

New model, in a new `prisma/schema/post-links.prisma`:

```prisma
model PostActionLink {
  id          String       @id @default(cuid())
  postSource  String       // "xenforo" | "native"
  postRef     String       // XenForo post id, or ForumPost.id
  activityId  String
  activity    ActivityFeed @relation(fields: [activityId], references: [id], onDelete: Cascade)
  countryId   String
  storylineId String?
  storyline   Storyline?   @relation(fields: [storylineId], references: [id], onDelete: SetNull)
  chainOrder  Int?
  createdAt   DateTime     @default(now())

  @@unique([postSource, postRef, activityId])
  @@index([activityId])
  @@index([storylineId])
}
```

- On post submit, the link rows for that post are replaced with the parsed set (delete then insert in one transaction).
- Reverse lookup: an activity can show "discussed in N posts".

## Story chains reuse `Storyline`

Additions to `Storyline`:

| Field | Type | Notes |
| --- | --- | --- |
| `kind` | `String @default("map")` | `map` (existing rows) or `chain` |
| `status` | `String @default("open")` | `open`, `submitted`, `approved`, `rejected` |
| `reviewedBy` | `String?` | reviewer user id |
| `reviewedAt` | `DateTime?` | |
| `wikiPageTitle` | `String?` | target page for the history section |
| `wikiSyncedAt` | `DateTime?` | set when the wiki section is written; null on an approved chain means retry |

Flow:

1. The player creates a `chain` Storyline for their country (or picks an open one).
2. From a post with action links, "Add to chain" sets `storylineId` and `chainOrder` on that post's `PostActionLink` rows.
3. The player submits the chain (`open` → `submitted`). A chain needs at least one linked post.
4. A site admin, or an officer of the country's realm, approves or rejects. A reviewer cannot review their own country's chain.
5. Approval:
   - Grants chain achievements via `UserAchievement` (seeded tiers, e.g. `story-chain-1`, `story-chain-5`, `story-chain-25`).
   - Appends a dated "Story chain: <title>" section to `wikiPageTitle` through the WikiOS page-management service (`src/lib/wiki-os/core/page-management-service.ts`). The section lists each post with its action card summary and a link back.
   - If the wiki write fails, approval stands and the failure is logged. `wikiSyncedAt` stays null, and an existing `server.mjs` cron retries approved chains with a null `wikiSyncedAt`. The wiki write never blocks or reverts the review.
6. A rejected chain goes back to `open` with the reviewer's note.

Existing map-Storyline queries must filter `kind: "map"` so chains never render as map connection lines.

## Code placement

- Parser and ownership check: `src/lib/action-links.ts` (pure, no DB).
- Service: `src/server/modules/action-links/` (link persistence, chain submit/review, achievement grant, wiki append).
- Router: `src/server/api/routers/actionLinks.ts`, registered in `root.ts` (thin: validate, call service).
- Card UI: `src/components/action-links/ActionCard.tsx` (`Card content="entity"`), picker `ActionPicker.tsx`.

## Testing

- `src/lib/action-links.test.ts`: token parsing (none, many, duplicates, malformed), ownership rejection.
- Router test: submit chain → approve → `UserAchievement` granted, wiki append called; wiki failure leaves the chain approved.
- Query test: map Storyline listings exclude `kind: "chain"`.
