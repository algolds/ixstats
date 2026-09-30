"use client";
// src/app/(forum)/forum/thread/[threadId]/page.tsx
// Thread view — SSR shell, then client-side pagination and interactions.

import { useParams } from "next/navigation";
import { ForumLayout } from "~/components/forum/shared/ForumLayout";
import { ThreadRenderer } from "~/components/forum/reader/ThreadRenderer";

export default function ThreadPage() {
  const params = useParams();
  const threadId = Number(params.threadId);

  if (isNaN(threadId)) {
    return (
      <ForumLayout>
        <div className="py-12 text-center">
          <h2 className="text-lg font-medium text-[var(--forum-text)]">Invalid thread</h2>
        </div>
      </ForumLayout>
    );
  }

  return (
    <ForumLayout>
      <ThreadRenderer threadId={threadId} />
    </ForumLayout>
  );
}
