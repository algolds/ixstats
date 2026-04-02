// src/app/(forum)/forum/new-thread/page.tsx
// New thread creation page.

"use client";

import { useSearchParams } from "next/navigation";
import { ForumLayout } from "~/components/forum/shared/ForumLayout";
import { ThreadComposer } from "~/components/forum/composer/ThreadComposer";

export default function NewThreadPage() {
  const searchParams = useSearchParams();
  const param = searchParams.get("forum");
  const parsed = param ? Number(param) : NaN;
  const defaultForumId = !isNaN(parsed) ? parsed : undefined;

  return (
    <ForumLayout>
      <ThreadComposer defaultForumId={defaultForumId} />
    </ForumLayout>
  );
}
