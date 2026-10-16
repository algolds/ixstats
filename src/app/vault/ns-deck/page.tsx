import { permanentRedirect } from "next/navigation";

/** NationStates import has one page: /vault/import (cards refresh §2.1). */
export default function NsDeckRedirectPage() {
  permanentRedirect("/vault/import");
}
