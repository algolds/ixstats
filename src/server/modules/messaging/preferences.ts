/**
 * Per-participant conversation preferences (mute, archive), kept in
 * `ConversationParticipant.notificationSettings` as JSON next to whatever else that column holds.
 */
import type { PrismaClient } from "@prisma/client";
import type { MessagingDependencies, SetConversationPreferencesInput } from "./contracts";
import { MessagingForbiddenError } from "./errors";

export interface ConversationPreferences {
  muted: boolean;
  archived: boolean;
}

function parseSettings(raw: string | null | undefined): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
      ? Object.fromEntries(Object.entries(parsed))
      : {};
  } catch {
    return {};
  }
}

export function preferencesOf(raw: string | null | undefined): ConversationPreferences {
  const settings = parseSettings(raw);
  return { muted: settings.muted === true, archived: settings.archived === true };
}

export class MessagingPreferenceOperations {
  private db: PrismaClient;

  constructor(dependencies: MessagingDependencies) {
    this.db = dependencies.db;
  }

  /** The conversations the actor muted and archived (the others carry no preference). */
  public async getConversationPreferences(actorId: string) {
    const rows = await this.db.conversationParticipant.findMany({
      where: { userId: actorId, isActive: true, notificationSettings: { not: null } },
      select: { conversationId: true, notificationSettings: true },
    });
    const muted: string[] = [];
    const archived: string[] = [];
    for (const row of rows) {
      const prefs = preferencesOf(row.notificationSettings);
      if (prefs.muted) muted.push(row.conversationId);
      if (prefs.archived) archived.push(row.conversationId);
    }
    return { muted, archived };
  }

  /** Sets the given preferences on the actor's own participant row, leaving other settings as they were. */
  public async setConversationPreferences(
    actorId: string,
    input: SetConversationPreferencesInput
  ): Promise<ConversationPreferences> {
    const participant = await this.db.conversationParticipant.findFirst({
      where: { conversationId: input.conversationId, userId: actorId, isActive: true },
      select: { id: true, notificationSettings: true },
    });
    if (!participant) throw new MessagingForbiddenError();

    const settings = parseSettings(participant.notificationSettings);
    if (input.muted !== undefined) settings.muted = input.muted;
    if (input.archived !== undefined) settings.archived = input.archived;
    await this.db.conversationParticipant.update({
      where: { id: participant.id },
      data: { notificationSettings: JSON.stringify(settings) },
    });
    return preferencesOf(JSON.stringify(settings));
  }
}
