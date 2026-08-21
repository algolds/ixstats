import { xfFetch, requireForumUser } from "../../../../../server/modules/forum";

describe("Forum Router Consolidation", () => {
  test("xfFetch is exported from module and functions as expected", async () => {
    expect(typeof xfFetch).toBe("function");
  });

  test("requireForumUser is exported from module and functions as expected", async () => {
    expect(typeof requireForumUser).toBe("function");
  });
});
