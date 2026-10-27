import { redirect } from "next/navigation";
import { createUrl } from "~/lib/utils";
import { sessionUserId } from "./session-user-id";

/** Signed-out visitors are sent to sign-in and brought back to `path` (`createUrl` only inside `redirect_url`). */
export async function requireSignIn(path: string): Promise<void> {
  if (await sessionUserId()) return;
  redirect(`/sign-in?redirect_url=${encodeURIComponent(createUrl(path))}`);
}
