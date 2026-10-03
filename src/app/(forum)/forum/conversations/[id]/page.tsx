// Redirects to ThinkShare — all private messaging is centralized there.

import { redirect } from "next/navigation";

export default function ForumConversationRedirect() {
  redirect("/messages");
}
