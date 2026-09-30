import { redirect } from "next/navigation";
import { createUrl } from "~/lib/utils";

export default function ImportFromWikiRedirectPage() {
  redirect(createUrl("/mycountry/builder?section=import"));
}
