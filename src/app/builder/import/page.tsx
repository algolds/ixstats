import { redirect } from "next/navigation";

/** The wiki import is a sheet in the founding flow; this opens it there. */
export default function ImportFromWikiRedirectPage() {
  redirect("/builder?import=1");
}
