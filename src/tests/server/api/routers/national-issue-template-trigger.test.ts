/** @jest-environment node */
/**
 * The admin template editor saves a trigger as written, the realm-relative `rank` condition included, and refuses one
 * the evaluator cannot read (it would silently never fire) instead of storing it.
 */
import { createTRPCRouter } from "~/server/api/trpc";
import { nationalIssuesTemplatesRouter } from "~/server/api/routers/national-issues/templates";
import { createIdorContext } from "~/tests/helpers/country-idor-context";

const RANKED = JSON.stringify({
  and: [{ rank: { field: "inflationRate" } }, { rank: { field: "actualGdpGrowth", side: "best", share: 0.5 } }],
});

function setup() {
  const create = jest.fn(async ({ data }: { data: object }) => ({ id: "t1", ...data }));
  const update = jest.fn(async ({ data }: { data: object }) => ({ id: "t1", ...data }));
  const ctx = createIdorContext({ nationalIssueTemplate: { create, update } }, "admin");
  const caller = createTRPCRouter({ t: nationalIssuesTemplatesRouter }).createCaller(ctx as never);
  return { caller, create, update };
}

// The admin audit log has no table in this mock; its write failure is logged and ignored.
beforeEach(() => jest.spyOn(console, "error").mockImplementation(() => undefined));
afterEach(() => jest.restoreAllMocks());

const base = {
  slug: "price_riots",
  title: "Price riots",
  description: "Prices bite.",
  domain: "economic" as const,
  responseOptions: "[]",
};

it("stores a rank trigger exactly as the editor sent it", async () => {
  const { caller, create, update } = setup();
  await caller.t.createTemplate({ ...base, triggerConditions: RANKED });
  expect(create.mock.calls[0]![0].data).toMatchObject({ triggerConditions: RANKED });
  await caller.t.updateTemplate({ id: "t1", triggerConditions: RANKED });
  expect(update.mock.calls[0]![0].data).toMatchObject({ triggerConditions: RANKED });
});

it("refuses a trigger with an unknown ranked field, and JSON that does not parse", async () => {
  const { caller, create, update } = setup();
  await expect(
    caller.t.createTemplate({ ...base, triggerConditions: JSON.stringify({ rank: { field: "shoeSize" } }) })
  ).rejects.toThrow(/not a ranked field/);
  await expect(caller.t.updateTemplate({ id: "t1", triggerConditions: "{nope" })).rejects.toThrow(
    /Invalid triggerConditions JSON/
  );
  expect(create).not.toHaveBeenCalled();
  expect(update).not.toHaveBeenCalled();
});
