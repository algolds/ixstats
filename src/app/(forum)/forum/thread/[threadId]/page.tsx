"use client";
// src/app/(forum)/forum/thread/[threadId]/page.tsx
// Thread view — SSR shell, then client-side pagination and interactions.

import { useParams } from "next/navigation";
import { ForumLayout } from "~/components/forum/shared/ForumLayout";
import { ThreadRenderer } from "~/components/forum/reader/ThreadRenderer";
import { EmptyState } from "~/components/ui/empty-state";

export default function ThreadPage() {
  const params = useParams();
  const threadId = Number(params.threadId);

  if (isNaN(threadId)) {
    return (
      <ForumLayout>
        <EmptyState title="Invalid thread" />
      </ForumLayout>
    );
  }

  return (
    <ForumLayout>
      <ThreadRenderer threadId={threadId} />
    </ForumLayout>
  );
}
