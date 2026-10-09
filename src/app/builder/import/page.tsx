import { redirect } from "next/navigation";

export default function ImportFromWikiRedirectPage() {
  redirect("/mycountry/builder?section=import");
}
