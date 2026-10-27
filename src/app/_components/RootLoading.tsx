"use client";

import { GlobalLoader } from "~/components/ui/loader";

/**
 * The loading UI of every non-wiki top-level route segment (each has a `loading.tsx` that
 * re-exports this). It used to be `src/app/loading.tsx`, which put a Suspense boundary above every
 * route, WikiOS's included: Next then flushes the shell before the page runs, so `notFound()` and
 * `redirect()` from a `/wiki/<path>` page answered HTTP 200 instead of 404 and 307/308. No
 * `loading.tsx` may be an ancestor of `src/app/(wiki-os)` (see the architecture test).
 */
export function RootLoading() {
  return <GlobalLoader />;
}
