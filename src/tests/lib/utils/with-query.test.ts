/** @jest-environment node */
/**
 * Player text placed into a URL or a SQL LIKE pattern is escaped, so it can add no query parameter or fragment and no
 * wildcard. One row per helper and the injection it stops. Folds address.test.ts and like-literal.test.ts.
 */
import { addressWith } from "~/lib/utils/address";
import { likeLiteral } from "~/lib/utils/like-literal";
import { withQuery } from "~/lib/utils/with-query";

it.each([
  [
    "withQuery keeps every value of a repeated key, in order",
    () => withQuery("/p", { tab: "trades", give: ["o1", "o2"] }),
    "/p?tab=trades&give=o1&give=o2",
  ],
  [
    "withQuery re-encodes a value so it adds no parameter or fragment",
    () => withQuery("/p", { tab: "x&admin=1#top" }),
    "/p?tab=x%26admin%3D1%23top",
  ],
  [
    "addressWith encodes the values it sets, and keeps the path only",
    () =>
      addressWith("https://ixstates.example/vault/cards/explore", (query) =>
        query.set("from", "holder.Ann Lee&co")
      ),
    "/vault/cards/explore?from=holder.Ann+Lee%26co",
  ],
  [
    "likeLiteral escapes the LIKE wildcards and the escape character",
    () => likeLiteral("100%_off\\"),
    "100\\%\\_off\\\\",
  ],
  ["likeLiteral leaves plain text alone", () => likeLiteral("Takatta Loa"), "Takatta Loa"],
] as const)("%s", (_case, run, expected) => {
  expect(run()).toBe(expected);
});
