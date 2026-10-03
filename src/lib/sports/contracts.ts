/**
 * Canonical Sports Domain Contracts & Focus Architecture
 * Based on the Unified MySports PRD (mysports-v0.md)
 */

export type SportsFocusType = "competition" | "organization" | "athlete" | "match";

export interface SportsFocus {
  type: SportsFocusType;
  id: string;
  extra?: Record<string, string>;
}

/**
 * Parses a focus parameter string such as "athlete:cm34xabc" or "organization:org123"
 */
export function parseSportsFocus(param: string | null | undefined): SportsFocus | null {
  if (!param || typeof param !== "string") return null;
  const parts = param.split(":");
  if (parts.length < 2) return null;

  const type = parts[0]?.toLowerCase();
  const id = parts[1];

  if (!id) return null;

  if (type === "competition" || type === "organization" || type === "athlete" || type === "match") {
    return {
      type: type as SportsFocusType,
      id,
    };
  }

  return null;
}

/**
 * Serializes a SportsFocus object to a URL search parameter string.
 */
export function serializeSportsFocus(focus: SportsFocus | null | undefined): string | null {
  if (!focus?.type || !focus?.id) return null;
  return `${focus.type}:${focus.id}`;
}
