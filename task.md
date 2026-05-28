# Achievements System Refactoring Task List

- [x] **Phase 1: Database Schema Updates**
  - [x] Add `Achievement` model to `prisma/schema/core.prisma` to store baseline and dynamic achievements.
  - [x] Modify `UserAchievement` model in `core.prisma` to relate to `Achievement` with cascade deletes.
  - [x] Run schema updates using `bun run db:push:force` to apply changes to the database.

- [x] **Phase 2: Core EventBus & Synchronization**
  - [x] Implement `EventBus` class in `src/lib/event-bus.ts` to publish actions (e.g. GDP updates, treaties, thinkpages, trades).
  - [x] Create baseline achievements seed/startup sync in `src/lib/achievement-sync.ts` to sync core definitions to database.
  - [x] Wire baseline sync execution to database startup hook or server hook.

- [x] **Phase 3: Asynchronous Evaluation Service**
  - [x] Refactor `achievementService` in `src/lib/achievement-service.ts` to subscribe to `EventBus` events.
  - [x] Implement local in-memory event processing queue (with Redis list backup if active) in `achievementService`.
  - [x] Refactor `checkAndUnlock` condition logic to load from database `Achievement` records and evaluate using hybrid JSON engine.
  - [x] Add JSON reward processing (IxCredits, card packs, badges, player titles).

- [x] **Phase 4: API & Routing Changes**
  - [x] Update achievements tRPC router in `src/server/api/routers/achievements.ts` to support fetching achievements list, progress statistics, and admin actions.
  - [x] Register new procedures or fix typing errors.

- [x] **Phase 5: Frontend UI Redesign**
  - [x] Update `src/app/achievements/page.tsx` with a dual layout.
  - [x] Implement **Quest Trees / Skill Paths tab** showing sequential branches (e.g., Merchant Path, Warlord Path) with locks and completion bars.
  - [x] Implement **Modular Card Grid tab** showing high-density cards with hover metrics and animated unlocks (no sounds).
