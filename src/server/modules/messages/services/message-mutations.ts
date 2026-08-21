import { type PrismaClient } from "@prisma/client";
import { TRPCError } from "@trpc/server";

export interface PersistMessageInput {
  conversationId: string;
  principalId: string;
  content: string;
  messageType: any;
  replyToId?: string;
  mentions?: any;
  attachments?: any;
  classification?: any;
  priority?: any;
  subject?: string;
}

export interface PersistMessageResult {
  message: any;
  conversation: any;
  otherParticipants: Array<{ userId: string }>;
}

export async function persistMessageTx(
  db: PrismaClient | any,
  input: PersistMessageInput
): Promise<PersistMessageResult> {
  return await db.$transaction(async (tx: any) => {
    // Verify participant
    const participant = await tx.conversationParticipant.findFirst({
      where: {
        conversationId: input.conversationId,
        userId: input.principalId,
        isActive: true,
      },
    });

    if (!participant) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "You are not a participant in this conversation",
      });
    }

    // Get the conversation to inherit source
    const conversation = await tx.thinkshareConversation.findUnique({
      where: { id: input.conversationId },
    });

    const message = await tx.thinkshareMessage.create({
      data: {
        conversationId: input.conversationId,
        userId: input.principalId,
        content: input.content,
        messageType: input.messageType,
        replyToId: input.replyToId,
        reactions: "{}",
        mentions: input.mentions ? JSON.stringify(input.mentions) : "[]",
        attachments: input.attachments ? JSON.stringify(input.attachments) : "[]",
        source: conversation?.source ?? "thinkshare",
        classification: input.classification,
        priority: input.priority,
        subject: input.subject,
      },
    });

    // Update conversation lastActivity
    await tx.thinkshareConversation.update({
      where: { id: input.conversationId },
      data: { lastActivity: new Date() },
    });

    // Fetch other active participants for notification
    const otherParticipants = await tx.conversationParticipant.findMany({
      where: {
        conversationId: input.conversationId,
        userId: { not: input.principalId },
        isActive: true,
      },
      select: {
        userId: true,
      },
    });

    return {
      message,
      conversation,
      otherParticipants,
    };
  });
}
