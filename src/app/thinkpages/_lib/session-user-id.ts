import { auth } from "@clerk/nextjs/server";
import { unstable_rethrow } from "next/navigation";

/** The signed-in Clerk user id, or null when signed out or the session cannot be read. */
export async function sessionUserId(): Promise<string | null> {
  try {
    return (await auth()).userId ?? null;
  } catch (error) {
    unstable_rethrow(error);
    return null;
  }
}
