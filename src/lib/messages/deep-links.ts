import type { MessageFolder } from "~/types/messages";

/** The one query parameter that selects a conversation; `id` and `conversationId` are older links. */
export const CONVERSATION_PARAM = "conversation";
const LEGACY_CONVERSATION_PARAMS = ["id", "conversationId"] as const;
/** `?view=archived` lists the archived threads instead of the inbox. */
export const VIEW_PARAM = "view";
export const ARCHIVED_VIEW = "archived";

const MAX_PARAM_LENGTH = 128;

export interface ParamReader {
  get(key: string): string | null;
}

/** What a /messages address asks for. At most one of the three targets is set: conversation, then country, then user. */
export interface MessagesAddress {
  conversationId: string | null;
  /** A country whose owner to open or start a direct message with. */
  countryId: string | null;
  /** A passport handle to open or start a direct message with. */
  userHandle: string | null;
  archived: boolean;
}

function clean(value: string | null): string | null {
  const trimmed = value?.trim();
  return trimmed && trimmed.length <= MAX_PARAM_LENGTH ? trimmed : null;
}

function conversationFrom(params: ParamReader): string | null {
  for (const key of [CONVERSATION_PARAM, ...LEGACY_CONVERSATION_PARAMS]) {
    const value = clean(params.get(key));
    if (value) return value;
  }
  return null;
}

export function parseMessagesAddress(params: ParamReader): MessagesAddress {
  const archived = params.get(VIEW_PARAM) === ARCHIVED_VIEW;
  const conversationId = conversationFrom(params);
  if (conversationId) return { conversationId, countryId: null, userHandle: null, archived };

  const countryId = clean(params.get("country"));
  if (countryId) return { conversationId: null, countryId, userHandle: null, archived };

  const userHandle = clean(params.get("user"))?.replace(/^@/, "") || null;
  return { conversationId: null, countryId: null, userHandle, archived };
}

/** Whether the address uses an older conversation parameter that should become `?conversation=`. */
export function hasLegacyConversationParam(params: ParamReader): boolean {
  return LEGACY_CONVERSATION_PARAMS.some((key) => params.get(key) !== null);
}

/**
 * Rewrites `?id=` and `?conversationId=` as `?conversation=` in place (an existing `?conversation=` wins).
 * Returns whether anything changed.
 */
export function normaliseConversationParams(query: URLSearchParams): boolean {
  if (!hasLegacyConversationParam(query)) return false;
  const canonical = clean(query.get(CONVERSATION_PARAM)) ?? conversationFrom(query);
  for (const key of LEGACY_CONVERSATION_PARAMS) query.delete(key);
  if (canonical) query.set(CONVERSATION_PARAM, canonical);
  else query.delete(CONVERSATION_PARAM);
  return true;
}

/** Points the query at one conversation (or none) and drops every target that was waiting to resolve. */
export function selectConversationParams(query: URLSearchParams, conversationId: string | null) {
  for (const key of [...LEGACY_CONVERSATION_PARAMS, "country", "user"]) query.delete(key);
  if (conversationId) query.set(CONVERSATION_PARAM, conversationId);
  else query.delete(CONVERSATION_PARAM);
}

export function setArchivedView(query: URLSearchParams, archived: boolean) {
  if (archived) query.set(VIEW_PARAM, ARCHIVED_VIEW);
  else query.delete(VIEW_PARAM);
}

const FOLDER_PATHS: Record<MessageFolder, string> = {
  conversations: "/messages",
  requests: "/messages/requests",
};

/** The app path of a folder, without the base path. */
export function messagesPath(folder: MessageFolder): string {
  return FOLDER_PATHS[folder];
}

/** The folder a pathname (without base path) is in: `/messages/requests` is Requests, anything else the inbox. */
export function folderFromPath(pathname: string | null | undefined): MessageFolder {
  const segments = (pathname ?? "").split("/").filter(Boolean);
  return segments[segments.length - 1] === "requests" ? "requests" : "conversations";
}
