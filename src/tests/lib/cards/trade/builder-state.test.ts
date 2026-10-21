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
const cara = { id: "p2", handle: "cara", displayName: "Caphiria" };

describe("trade builder state", () => {
  it("starts from a seed, or empty", () => {
    expect(initialBuilderState()).toEqual({
      partner: null,
      give: { cardIds: [], credits: 0 },
      get: { cardIds: [], credits: 0 },
      message: "",
    });
    expect(initialBuilderState({ give: ["a"], get: ["b"] })).toMatchObject({
      give: { cardIds: ["a"] },
      get: { cardIds: ["b"] },
    });
  });

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

  it("drops a card from whichever side holds it, and only that card", () => {
    let state = initialBuilderState({ give: ["a", "c"], get: ["b"] });
    state = builderReducer(state, { type: "drop", ownershipId: "a" });
    state = builderReducer(state, { type: "drop", ownershipId: "b" });
    // Dropping twice changes nothing: unlike a toggle it never adds the card back.
    state = builderReducer(state, { type: "drop", ownershipId: "b" });
    expect(state.give.cardIds).toEqual(["c"]);
    expect(state.get.cardIds).toEqual([]);
  });

  it("clears what you asked of one partner when you switch to another, or to none", () => {
    let state = builderReducer(initialBuilderState({ give: ["a"], get: ["b"] }), {
      type: "partner",
      partner: bob,
    });
    expect(state.partner).toEqual(bob);
    expect(state.get.cardIds).toEqual(["b"]);
    state = builderReducer(state, { type: "credits", side: "get", credits: 40 });
    state = builderReducer(state, { type: "partner", partner: { ...bob, displayName: null } });
    expect(state.get).toEqual({ cardIds: ["b"], credits: 40 });
    state = builderReducer(state, { type: "partner", partner: cara });
    expect(state.get).toEqual({ cardIds: [], credits: 0 });
    expect(state.give.cardIds).toEqual(["a"]);
    state = builderReducer(state, { type: "toggle", side: "get", ownershipId: "c1" });
    state = builderReducer(state, { type: "partner", partner: null });
    expect(state.partner).toBeNull();
    expect(state.get.cardIds).toEqual([]);
  });

  it("keeps the note to what the server takes", () => {
    const state = builderReducer(initialBuilderState(), { type: "message", message: "x".repeat(600) });
    expect(state.message).toHaveLength(500);
  });

  it("loads a whole state", () => {
    const loaded: BuilderState = {
      partner: bob,
      give: { cardIds: ["g"], credits: 1 },
      get: { cardIds: [], credits: 2 },
      message: "hi",
    };
    expect(builderReducer(initialBuilderState({ give: ["x"] }), { type: "load", state: loaded })).toBe(
      loaded
    );
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
