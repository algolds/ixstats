import { describe, it, expect } from "@jest/globals";
import {
  toPublicDirectives,
  toPublicIssueOutcomes,
  type IntentLike,
  type IssueLike,
} from "~/app/countries/[slug]/_utils/profileLayer";

const ixTime = (iso: string) => Date.parse(iso);

const intent = (overrides: Partial<IntentLike>): IntentLike => ({
  id: "i",
  goal: "Goal",
  tier: "measured",
  category: "economy",
  status: "active",
  summary: null,
  progress: 40,
  createdIxTime: ixTime("2041-03-01T00:00:00Z"),
  ...overrides,
});

const issue = (overrides: Partial<IssueLike>): IssueLike => ({
  id: "n",
  title: "Issue",
  domain: "economy",
  status: "responded",
  chosenOptionLabel: "Option A",
  consequenceLog: "Approval rose.",
  respondedIxTime: ixTime("2041-05-01T00:00:00Z"),
  ...overrides,
});

describe("public record filter", () => {
  it("keeps only enacted directives (in force or completed), newest first", () => {
    const result = toPublicDirectives([
      intent({ id: "draft", status: "proposed" }),
      intent({ id: "old", status: "completed", createdIxTime: ixTime("2040-01-01T00:00:00Z") }),
      intent({ id: "withdrawn", status: "abandoned" }),
      intent({ id: "new", status: "active", createdIxTime: ixTime("2042-01-01T00:00:00Z") }),
    ]);
    expect(result.map((d) => d.id)).toEqual(["new", "old"]);
    expect(result.find((d) => d.id === "old")?.progress).toBe(40);
    // A draft tier never counts as enacted, whatever its status says.
    expect(toPublicDirectives([intent({ id: "odd", status: "active", tier: "proposed" })])).toEqual(
      []
    );
    // Nothing private rides along.
    expect(Object.keys(result[0]!)).not.toContain("changesJson");
    expect(Object.keys(result[0]!)).not.toContain("execBandwidthCost");
  });
  it("keeps only resolved issues and names the decision and outcome", () => {
    const result = toPublicIssueOutcomes([
      issue({ id: "open", status: "pending" }),
      issue({ id: "seen", status: "viewed" }),
      issue({ id: "expired", status: "expired" }),
      issue({ id: "dismissed", status: "dismissed" }),
      issue({ id: "chosen" }),
      issue({
        id: "lapsed",
        status: "auto_resolved",
        chosenOptionLabel: null,
        autoResolveLabel: "Default path",
        respondedIxTime: ixTime("2041-06-01T00:00:00Z"),
      }),
    ]);
    expect(result.map((o) => o.id)).toEqual(["lapsed", "chosen"]);
    expect(result[0]).toMatchObject({ decision: "Default path", resolvedBy: "default" });
    expect(result[1]).toMatchObject({
      decision: "Option A",
      outcome: "Approval rose.",
      resolvedBy: "government",
    });
  });
});
