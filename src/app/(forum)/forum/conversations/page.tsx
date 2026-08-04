// src/app/(forum)/forum/conversations/page.tsx
// Redirects to ThinkShare — all private messaging is centralized there.

import { redirect } from "next/navigation";

// TODO: Cache Components adoption. Refactor this route so this opt-out can be removed.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

export default function ForumConversationsRedirect() {
  redirect("/messages");
}
