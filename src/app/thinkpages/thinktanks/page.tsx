import { permanentRedirect } from "next/navigation";

/** ThinkTanks has its own app. */
export default function LegacyThinkTanksPage() {
  permanentRedirect("/thinktanks");
}
