// WikiOS random page: a server redirect to a random article, the same lookup as Special:Random.

import { redirectToRandomPage } from "../../_lib/random-page";

// A different page on every request, never a prerendered one.
export const dynamic = "force-dynamic";

export default function RandomPage(): Promise<never> {
  return redirectToRandomPage();
}
