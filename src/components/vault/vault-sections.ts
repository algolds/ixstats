import { stripBasePath } from "~/lib/base-path";
export type VaultSection = "dashboard" | "cards" | "import";

/** Map a pathname to the sub-tab within its section */
export function getSubTabFromPathname(rawPathname: string): string | null {
  const pathname = stripBasePath(rawPathname);
  // Cards section sub-tabs
  if (pathname.startsWith("/vault/collections")) return "collections";
  if (
    pathname.startsWith("/vault/gallery") ||
    pathname.startsWith("/vault/lore-gallery") ||
    pathname.startsWith("/vault/ns-library") ||
    pathname.startsWith("/vault/cards")
  )
    return "gallery";
  if (pathname.startsWith("/vault/inventory")) return "inventory";

  return null;
}
