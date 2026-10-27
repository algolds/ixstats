/** @jest-environment node */
/** The `wikios>` names only the account's own WikiOS edits carry, for the Lorewards achievements (design decision 22). */
import { exclusiveWikiosNames } from "~/lib/lorewards/account-names";

const dbOf = (rows: Array<{ author: string }>) => {
  const queryRaw = jest.fn(async (_strings: TemplateStringsArray, ..._values: string[]) => rows);
  return { db: { $queryRaw: queryRaw } as never, queryRaw };
};

it("maps the account's exclusive edit labels to their wikios> names", async () => {
  const { db } = dbOf([{ author: "alpha" }, { author: "Kir land" }]);
  expect(await exclusiveWikiosNames(db, "u1")).toEqual(["wikios>alpha", "wikios>Kir land"]);
});

it("leaves out labels another account's revisions carry, binding the account id twice", async () => {
  const { db, queryRaw } = dbOf([]);
  expect(await exclusiveWikiosNames(db, "u1")).toEqual([]);
  const [strings, ...values] = queryRaw.mock.calls[0]!;
  expect(strings.join("?")).toContain("NOT EXISTS");
  expect(values).toEqual(["u1", "u1"]);
});
