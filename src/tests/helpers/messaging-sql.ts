/**
 * The memory Prisma client has no SQL engine, so the two grouped unread-count statements of the messaging
 * queries (the folder badges and the conversation list) are answered here from the tables, the way Postgres would.
 */
import type { MemoryPrisma } from "~/tests/helpers/memory-prisma";

type Row = Record<string, unknown>;

const at = (value: unknown) => (value instanceof Date ? value.getTime() : Number(value));

export function answerMessagingSql(db: MemoryPrisma): MemoryPrisma {
  db.store.onRaw(/COUNT\(\*\)::int AS unread FROM "ThinkshareMessage"/, (values, text, store) => {
    const forList = text.includes("ANY(?::text[])");
    const actor = values[0] as string;
    const only = forList ? new Set(values[1] as string[]) : null;
    const blocked = new Set(values[values.length - 1] as string[]);
    const participants = store.rows("ConversationParticipant");
    const conversations = store.rows("ThinkshareConversation");

    const counts = new Map<string, number>();
    for (const m of store.rows("ThinkshareMessage") as Row[]) {
      const conversationId = m.conversationId as string;
      if (only && !only.has(conversationId)) continue;
      const p = participants.find(
        (row) =>
          row.conversationId === conversationId &&
          row.userId === actor &&
          row.isActive === true &&
          (forList || row.requestStatus !== "pending")
      );
      const c = conversations.find((row) => row.id === conversationId);
      if (!p || !c) continue;
      if (m.userId === actor || m.deletedAt) continue;
      if (at(m.ixTimeTimestamp) <= at(p.lastReadAt)) continue;
      if (c.type !== "direct" && blocked.has(m.userId as string)) continue;
      counts.set(conversationId, (counts.get(conversationId) ?? 0) + 1);
    }
    return [...counts].map(([conversationId, unread]) => ({ conversationId, unread }));
  });
  return db;
}
