import type { EventTraceStep } from "../types";
import type { RosterPlayer } from "./types";

export type Side = "home" | "away";
export const SIDES: readonly Side[] = ["home", "away"];

export const otherSide = (side: Side): Side => (side === "home" ? "away" : "home");
export const sideLabel = (side: Side) => (side === "home" ? "Home" : "Away");
export const fullName = (p: Pick<RosterPlayer, "firstName" | "lastName">) =>
  `${p.firstName} ${p.lastName}`;
export const actorOf = (p: RosterPlayer) => ({ id: p.id, name: fullName(p) });

type Actor = { id: string; name: string } | null | undefined;

/** A match event log plus its `push` helper (the actor, when given, becomes actorId/actorName). */
export function createTrace() {
  const trace: EventTraceStep[] = [];
  const push = (
    t: number,
    type: EventTraceStep["type"],
    description: string,
    team: Side,
    actor?: Actor
  ) =>
    trace.push({
      t,
      type,
      description,
      ...(actor && { actorId: actor.id, actorName: actor.name }),
      team,
    });
  return { trace, push };
}
