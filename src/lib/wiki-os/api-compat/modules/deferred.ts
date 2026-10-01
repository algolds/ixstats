/**
 * deferred.ts — what the modules that wait for plan 406 say (`list=embeddedin`, `list=imageusage`,
 * `prop=templates`, `prop=images` and the matching generators).
 *
 * They need `WikiTemplateLink` and `WikiImageLink`, which plan 406 adds. Until it merges they answer
 * `badvalue` with this reason; the coordinator replaces them with the real modules afterwards.
 */

export const DEFERRED_REASON =
  "WikiOS has no template or image link tables yet (plan 406), so this module is not available.";
