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
