/**
 * Forum router — split across files by domain (2026-06-13) and recombined here.
 *
 * mergeRouters preserves every procedure at the top level, so the public API path
 * `api.forum.*` is byte-identical to the former monolith — no call sites change.
 *
 * Domains:
 *  - reading:  public read endpoints (recent threads, forums, threads, posts, members, search)
 *  - stash:    LoreStash integration for forum threads (stash / unstash / list)
 *  - writing:  write endpoints that require a linked forum account (create/reply/edit/delete, react, bookmark, mark-read)
 *  - account:  moderation (admin), XenForo alert sync, and forum account linking/sync
 */
import { mergeRouters } from "~/server/api/trpc";
import { forumReadingRouter } from "./reading";
import { forumStashRouter } from "./stash";
import { forumWritingRouter } from "./writing";
import { forumAccountRouter } from "./account";

export const forumRouter = mergeRouters(
  forumReadingRouter,
  forumStashRouter,
  forumWritingRouter,
  forumAccountRouter
);
