import { redirect } from "next/navigation";
import { sessionUserId } from "~/app/thinkpages/_lib/session-user-id";
import { unreadTargetFor } from "~/server/api/routers/thinkpagesForum/unread-target";
import { db } from "~/server/db";

interface UnreadThreadPageProps {
  params: Promise<{ threadId: string }>;
}

/**
 * Opens a thread at its first unread post. Temporary (307): the answer depends on who asks and on what they have read.
 * A server redirect, so the route has no loading.tsx.
 */
export default async function UnreadThreadPage({ params }: UnreadThreadPageProps) {
  const { threadId } = await params;
  redirect(await unreadTargetFor(db, await sessionUserId(), threadId));
}
