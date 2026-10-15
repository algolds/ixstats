import { redirect } from "next/navigation";

/** Stashed threads live in the one Stash, /stashes (its Threads tab). */
export default function StashedRoute() {
  redirect("/stashes");
}
