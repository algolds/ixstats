/**
 * Forum router — split across files by domain (2026-06-13) and recombined here.
 *
 * mergeRouters preserves every procedure at the top level, so the public API path
 * `api.forum.*` is byte-identical to the former monolith — no call sites change.
 *
 * Domains:
 *  - reading:  public read endpoints (recent threads, forums, a thread with its posts, members, search)
 *  - stash:    Stash integration for forum threads (stash / unstash / is-stashed / list)
 *  - writing:  write endpoints that require a linked forum account (create/reply/edit/delete, react, mark-read)
 *  - account:  forum account link status
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
