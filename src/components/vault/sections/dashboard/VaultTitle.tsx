import { shellPageTitleProps } from "~/components/shell/ShellPageHeader";
import { VaultLogomark } from "~/lib/navigation/icons/VaultLogomark";
import { IconWell } from "./IconWell";

/** The Vault mark on a large tinted tile: decorative, beside the page title. */
export function VaultMarkTile() {
  return (
    <IconWell size="lg">
      <VaultLogomark />
    </IconWell>
  );
}

/**
 * The page's title on desktop: the mark beside "Vault", above the Your Vault list. Phones have no top bar, so
 * their title is the phone-only `ShellPageHeader`; this one is marked as the page's own title and hides wherever
 * that header shows, so exactly one "Vault" is visible at every width.
 */
export function VaultTitle() {
  return (
    <div {...shellPageTitleProps} className="flex items-center gap-3 pb-4">
      <VaultMarkTile />
      <h1 className="text-title-1 text-label min-w-0 truncate">Vault</h1>
    </div>
  );
}
