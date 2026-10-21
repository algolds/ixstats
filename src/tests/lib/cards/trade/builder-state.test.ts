/** @jest-environment node */
/** The trade builder's state: a partner, You give and You get, and how it maps to the stored table and back. */
import {
  builderReducer,
  builderTable,
  initialBuilderState,
  stateFromTrade,
  type BuilderState,
} from "~/lib/cards/trade/builder-state";

const bob = { id: "p1", handle: "bob", displayName: "@bob" };
describe("trade builder state", () => {
  it("toggles cards on each side and keeps credits whole and non-negative", () => {
    let state = initialBuilderState({ give: ["a"] });
    state = builderReducer(state, { type: "toggle", side: "get", ownershipId: "b" });
    state = builderReducer(state, { type: "toggle", side: "give", ownershipId: "a" });
    state = builderReducer(state, { type: "credits", side: "give", credits: 12.7 });
    state = builderReducer(state, { type: "credits", side: "get", credits: -5 });
    expect(state.give).toEqual({ cardIds: [], credits: 12 });
    expect(state.get).toEqual({ cardIds: ["b"], credits: 0 });
    state = builderReducer(state, { type: "credits", side: "give", credits: Number("abc") });
    expect(state.give.credits).toBe(0);
  });
  it("maps to the stored table from either party's side and back", () => {
    const state: BuilderState = {
      partner: bob,
      give: { cardIds: ["b1"], credits: 0 },
      get: { cardIds: ["a1"], credits: 300 },
      message: "",
    };
    const table = builderTable(state, "recipient");
    expect(table).toEqual({
      initiatorCardIds: ["a1"],
      recipientCardIds: ["b1"],
      initiatorCredits: 300,
      recipientCredits: 0,
    });
    expect(builderTable(state, "initiator")).toEqual({
      initiatorCardIds: ["b1"],
      recipientCardIds: ["a1"],
      initiatorCredits: 0,
      recipientCredits: 300,
    });
    const trade = {
      initiatorCardIdList: table.initiatorCardIds,
      recipientCardIdList: table.recipientCardIds,
      initiatorCredits: 300,
      recipientCredits: 0,
      initiator: { id: "alice", passportHandle: "alice", displayName: "Aurelia" },
      recipient: { id: "bob", passportHandle: "bob", displayName: "@bob" },
    };
    expect(stateFromTrade(trade, "recipient")).toEqual({
      partner: { id: "alice", handle: "alice", displayName: "Aurelia" },
      give: { cardIds: ["b1"], credits: 0 },
      get: { cardIds: ["a1"], credits: 300 },
      message: "",
    });
    expect(stateFromTrade(trade, "initiator")).toMatchObject({
      partner: { id: "bob", handle: "bob", displayName: "@bob" },
      give: { cardIds: ["a1"], credits: 300 },
      get: { cardIds: ["b1"], credits: 0 },
    });
  });
});
