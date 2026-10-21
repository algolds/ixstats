// src/lib/cards/card-notify.ts
/**
 * Card notices (in-app, spec §2.3 Notifications), sent after the money has moved. A player can mute one card: no
 * notices about it reach them. Pack events have their own category. Both categories follow the recipient's
 * notification preferences (`~/lib/notifications/recipient-preferences`). A failed notice is logged and never fails
 * the caller.
 */
import type { PrismaClient } from "@prisma/client";
import { notificationAPI, type NotificationType } from "~/lib/notifications/api";

export type CardNoticeCategory = "cards" | "packs";

export interface CardNotice {
  /** `User.id` of the recipient. */
  userId: string;
  /** The card the notice is about; a muted card's notices are dropped. */
  cardId?: string;
  title: string;
  message: string;
  type?: NotificationType;
  priority?: "low" | "medium" | "high";
  href?: string;
  category?: CardNoticeCategory;
  metadata?: Record<string, string | number | boolean | null>;
}

type MuteDb = Pick<PrismaClient, "cardNotificationMute">;

export async function isCardMuted(db: MuteDb, userId: string, cardId: string): Promise<boolean> {
  const row = await db.cardNotificationMute.findUnique({
    where: { userId_cardId: { userId, cardId } },
    select: { userId: true },
  });
  return row !== null;
}

export async function setCardMute(
  db: MuteDb,
  userId: string,
  cardId: string,
  muted: boolean
): Promise<void> {
  if (muted) {
    await db.cardNotificationMute.upsert({
      where: { userId_cardId: { userId, cardId } },
      create: { userId, cardId },
      update: {},
    });
    return;
  }
  await db.cardNotificationMute.deleteMany({ where: { userId, cardId } });
}

export async function notifyCard(db: MuteDb, notice: CardNotice): Promise<void> {
  try {
    if (notice.cardId && (await isCardMuted(db, notice.userId, notice.cardId))) return;
    await notificationAPI.create({
      userId: notice.userId,
      title: notice.title,
      message: notice.message,
      type: notice.type ?? "info",
      priority: notice.priority ?? "medium",
      category: notice.category ?? "cards",
      source: "cards",
      href: notice.href ?? null,
      metadata: { ...notice.metadata, ...(notice.cardId ? { cardId: notice.cardId } : {}) },
    });
  } catch (error) {
    console.warn(`[CardNotify] "${notice.title}" for ${notice.userId} failed:`, error);
  }
}

/** One after another, each on its own: a failed notice stops none of the rest. */
export async function notifyCards(db: MuteDb, notices: CardNotice[]): Promise<void> {
  for (const notice of notices) await notifyCard(db, notice);
}
