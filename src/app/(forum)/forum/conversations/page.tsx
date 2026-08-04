// src/app/(forum)/forum/conversations/page.tsx
// Redirects to ThinkShare — all private messaging is centralized there.

import { redirect } from "next/navigation";


export default function ForumConversationsRedirect() {
  redirect("/messages");
}
