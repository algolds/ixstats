/**
 * U9: a mention's hover card queries a profile only when the link names one. A profile slug the id pattern cannot
 * read (`@`, `%`-escapes) gives no id, and then nothing is queried rather than a lookup of an empty name.
 */
import { describe, expect, it } from "@jest/globals";
import { mentionQueries } from "~/lib/wiki-os/mention-target";

describe("mentionQueries", () => {
  it("queries the profile a mention names, once its card is open", () => {
    expect(mentionQueries(true, "/dashboard/profile/jane_doe")).toEqual({
      entityId: "jane_doe",
      league: false,
      club: false,
      country: false,
      user: true,
    });
    expect(mentionQueries(false, "/dashboard/profile/jane_doe").user).toBe(false);
    expect(mentionQueries(true, "/myleague/l1")).toMatchObject({ entityId: "l1", league: true });
    expect(mentionQueries(true, "/countries/Caphiria")).toMatchObject({ country: true });
  });

  it.each(["/dashboard/profile/@jane", "/thinkpages/profile/%20jane", "/countries/"])(
    "queries nothing for %s, whose id is empty",
    (href) => {
      expect(mentionQueries(true, href)).toEqual({
        entityId: "",
        league: false,
        club: false,
        country: false,
        user: false,
      });
    }
  );
});
