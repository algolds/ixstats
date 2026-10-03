import { parseReactionCounts } from "~/components/thinkpages/primitives/ReactionCacheUpdater";

describe("parseReactionCounts", () => {
  it("parses a JSON object string and passes an object through", () => {
    expect(parseReactionCounts('{"like":2}')).toEqual({ like: 2 });
    expect(parseReactionCounts({ like: 1 })).toEqual({ like: 1 });
  });

  it.each([["null"], ["not json"], ["[1,2]"], ['"x"'], ["5"], [""], [null], [undefined]])(
    "gives empty counts for %p",
    (raw) => {
      expect(parseReactionCounts(raw)).toEqual({});
    }
  );
});
