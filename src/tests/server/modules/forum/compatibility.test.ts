import { forumBridge as canonicalBridge } from "~/server/modules/forum";
import { forumBridge as compatBridge } from "~/server/bridges/forum-bridge";

describe("Forum Bridge Compatibility", () => {
  test("compat re-export and canonical module bridge are referentially equal", () => {
    expect(compatBridge).toBe(canonicalBridge);
  });
});
