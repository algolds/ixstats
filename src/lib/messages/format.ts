import { isToday } from "date-fns";
import { escapeRegExp } from "~/lib/utils/escape-regexp";

const DATE_TIME_FORMAT: Intl.DateTimeFormatOptions = {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
};

/** The time alone for today, the date and time for anything older. */
export function formatTimestamp(date: Date | string): string {
  const d = new Date(date);
  return d.toLocaleString(
    undefined,
    isToday(d) ? { hour: "numeric", minute: "2-digit" } : DATE_TIME_FORMAT
  );
}

export const stripTags = (html: string): string => html.replace(/<[^>]*>/g, "");

/** Wraps search matches in <mark>, leaving HTML tags untouched. */
export function highlightMatches(content: string, query?: string): string {
  if (!query?.trim()) return content;
  const regex = new RegExp(`(${escapeRegExp(query)})`, "gi");
  return content
    .split(/(<[^>]+>)/g)
    .map((part) =>
      part.startsWith("<") && part.endsWith(">")
        ? part
        : part.replace(regex, '<mark class="bg-yellow/40 text-label rounded-xs px-0.5">$1</mark>')
    )
    .join("");
}

export type DisplayNamePreference = "account" | "country";

/** A sender's name as the viewer chose to see it: `@handle` or the display name. */
export function displayNameOf(
  account: { username?: string; displayName: string },
  preference?: DisplayNamePreference
): string {
  return preference === "account" && account.username
    ? `@${account.username}`
    : account.displayName;
}

/** Up to two capital letters for an avatar with no picture. */
export function initialsOf(name: string): string {
  return name
    .replace(/^@/, "")
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0]!.toUpperCase())
    .join("")
    .slice(0, 2);
}

/** An enum value such as TOP_SECRET, read as a phrase: "Top secret". */
export function humanizeEnum(value: string): string {
  const words = value.toLowerCase().replace(/_/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}
