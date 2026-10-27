/**
 * Who may open Labs (`/labs/*`), shared by the server gate (`src/app/labs/layout.tsx`, SL-27) and
 * matching the navigation shell, which shows the Labs app to the same people: a signed-in user
 * while the admin navigation setting `showLabsTab` is on (the default), and otherwise only admins
 * (role level 10 or lower, or a system owner), holders of the `labs.access` permission, and
 * everyone in a development build.
 */
import { getVisibleApps } from "./app-sections";

export interface LabsAccessInput {
  signedIn: boolean;
  isAdmin: boolean;
  hasLabsAccess: boolean;
  /** The stored `showLabsTab` value; undefined when never saved (defaults to on). */
  showLabsTab: boolean | undefined;
}

export type LabsAccess = "allowed" | "signed-out" | "denied";

export function labsAccessDecision(input: LabsAccessInput): LabsAccess {
  if (!input.signedIn) return "signed-out";
  const visible = getVisibleApps({
    signedIn: true,
    isAdmin: input.isAdmin,
    hasLabsAccess: input.hasLabsAccess,
    navigationSettings: { showLabsTab: input.showLabsTab ?? true },
  });
  return visible.some((app) => app.id === "labs") ? "allowed" : "denied";
}
