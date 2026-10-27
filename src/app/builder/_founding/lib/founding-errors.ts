/**
 * createCountry's refusals in plain words, each with the step that fixes it.
 */

import type { FoundingStepId } from "./founding-draft";

export interface FoundingError {
  title: string;
  body: string;
  /** The step that fixes it, and the button's words; none when the fix is outside the flow. */
  fix?: { step: FoundingStepId; label: string };
}

interface ErrorLike {
  message?: string;
  data?: { code?: string } | null;
}

export function describeFoundingError(error: unknown, canChooseRealm: boolean): FoundingError {
  const { message = "", data } = (error ?? {}) as ErrorLike;
  const code = data?.code;
  const lower = message.toLowerCase();
  const otherRealm = canChooseRealm
    ? { step: "realm" as const, label: "Choose another realm" }
    : undefined;

  if (lower.includes("already exists")) {
    return {
      title: "That name is taken in this realm",
      body: "Another nation in this realm already has this name. Choose a different one.",
      fix: { step: "identity", label: "Change the name" },
    };
  }
  if (lower.includes("lore")) {
    return {
      title: "That nation belongs to the realm's lore",
      body: "Claim it from the realm's page instead, or choose a different name to found a new nation.",
      fix: { step: "identity", label: "Change the name" },
    };
  }
  if (lower.includes("already hold") || lower.includes("cap")) {
    return {
      title: "You hold as many nations as this realm allows",
      body: message || "Found your nation in another realm, or give up a nation you hold here.",
      fix: otherRealm,
    };
  }
  if (lower.includes("not open")) {
    return {
      title: "This realm is not taking new nations",
      body: "Its officers have closed it to new nations for now.",
      fix: otherRealm,
    };
  }
  if (code === "NOT_FOUND" && lower.includes("realm")) {
    return {
      title: "That realm no longer exists",
      body: "Choose another realm to found your nation in.",
      fix: otherRealm,
    };
  }
  if (lower.includes("role") || lower.includes("user account") || code === "UNAUTHORIZED") {
    return {
      title: "Your account is not set up yet",
      body: "Sign out and sign in again. If this keeps happening, contact support.",
    };
  }
  return {
    title: "Your nation could not be founded",
    body: message
      ? `${message.replace(/\.+$/, "")}. Your draft is saved, so try again in a moment.`
      : "Check your connection and try again. Your draft is saved.",
  };
}
