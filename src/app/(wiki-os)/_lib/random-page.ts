import "server-only";

import { notFound, redirect } from "next/navigation";
import { canonicalizeTitle } from "~/lib/wiki-os/core/title";
import { api } from "~/trpc/server";

/**
 * A random published page, by a temporary redirect (the answer changes on every request).
 * `Special:Random` and `/util/random` both land here.
 */
export async function redirectToRandomPage(): Promise<never> {
  const { title } = await api.wikios.getRandomPage();
  const canon = canonicalizeTitle(title ?? "");
  if (!canon) notFound();
  return redirect(`/wiki/${canon.urlPath}`);
}
