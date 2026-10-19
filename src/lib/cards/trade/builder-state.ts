/** The trade builder's state (client-safe): a partner, two sides of cards and credits, and a note. */
import type { CardFaceData } from "~/lib/cards/face/types";
import {
  sidesFor,
  tableFrom,
  type TradeRole,
  type TradeSide,
  type TradeTable,
} from "./trade-table";

export interface BuilderPartner {
  id: string;
  /** Their passport handle, which finds them again. */
  handle: string;
  /** Their name by the identity rule; null reads "a player". */
  displayName: string | null;
}

export interface BuilderState {
  partner: BuilderPartner | null;
  give: TradeSide;
  get: TradeSide;
  message: string;
}

export type BuilderSide = "give" | "get";

export type BuilderAction =
  | { type: "partner"; partner: BuilderPartner | null }
  | { type: "toggle"; side: BuilderSide; ownershipId: string }
  /** Takes a copy off the table wherever it is, and never puts it back (a seed that turned out untradeable). */
  | { type: "drop"; ownershipId: string }
  | { type: "credits"; side: BuilderSide; credits: number }
  | { type: "message"; message: string }
  | { type: "load"; state: BuilderState };

/** A copy as the table shows it: an open trade's copy, a tradeable one, or the copy a link seeded. */
export interface TradeCopyLike {
  ownershipId: string;
  face: CardFaceData;
  /** The text only: who signed it is the card sheet's to show. */
  inscription: string | null;
  /** From the server (a retired card's copy is 0). */
  value: number;
}

/** What the server keeps of a note. */
const MESSAGE_MAX = 500;

const EMPTY_SIDE: TradeSide = { cardIds: [], credits: 0 };

export function initialBuilderState(seed: { give?: string[]; get?: string[] } = {}): BuilderState {
  return {
    partner: null,
    give: { cardIds: seed.give ?? [], credits: 0 },
    get: { cardIds: seed.get ?? [], credits: 0 },
    message: "",
  };
}

const toggle = (ids: string[], id: string) =>
  ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
const without = (side: TradeSide, id: string): TradeSide => ({
  ...side,
  cardIds: side.cardIds.filter((x) => x !== id),
});

export function builderReducer(state: BuilderState, action: BuilderAction): BuilderState {
  switch (action.type) {
    case "partner": {
      if (state.partner === null || action.partner?.id === state.partner.id) {
        return { ...state, partner: action.partner };
      }
      // Another partner, or none: what you asked of the old one no longer applies.
      return { ...state, partner: action.partner, get: EMPTY_SIDE };
    }
    case "toggle": {
      const side = state[action.side];
      return {
        ...state,
        [action.side]: { ...side, cardIds: toggle(side.cardIds, action.ownershipId) },
      };
    }
    case "drop":
      return {
        ...state,
        give: without(state.give, action.ownershipId),
        get: without(state.get, action.ownershipId),
      };
    case "credits": {
      const credits = Number.isFinite(action.credits) ? Math.max(0, Math.floor(action.credits)) : 0;
      return { ...state, [action.side]: { ...state[action.side], credits } };
    }
    case "message":
      return { ...state, message: action.message.slice(0, MESSAGE_MAX) };
    case "load":
      return action.state;
  }
}

export function builderTable(state: BuilderState, viewer: TradeRole): TradeTable {
  return tableFrom(viewer, state.give, state.get);
}

/** A party of an open trade, as the router names them. */
interface NamedParty {
  id: string;
  passportHandle: string;
  displayName: string | null;
}

/** What the builder reads of an open trade (the trade view fits). */
interface OpenTrade {
  initiatorCardIdList: string[];
  recipientCardIdList: string[];
  initiatorCredits: number;
  recipientCredits: number;
  initiator: NamedParty;
  recipient: NamedParty;
}

/** The builder state for an open trade, from the viewer's side. */
export function stateFromTrade(trade: OpenTrade, viewer: TradeRole): BuilderState {
  const other = viewer === "initiator" ? trade.recipient : trade.initiator;
  const table: TradeTable = {
    initiatorCardIds: trade.initiatorCardIdList,
    recipientCardIds: trade.recipientCardIdList,
    initiatorCredits: trade.initiatorCredits,
    recipientCredits: trade.recipientCredits,
  };
  const { give, get } = sidesFor(table, viewer);
  return {
    partner: { id: other.id, handle: other.passportHandle, displayName: other.displayName },
    give,
    get,
    message: "",
  };
}
