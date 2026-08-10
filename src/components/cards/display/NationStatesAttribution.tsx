/**
 * NationStates attribution + disclaimer
 *
 * Shown wherever NationStates-imported card data is displayed so users can
 * see where the data comes from and its licensing status. This addresses the
 * common (and usually incorrect) worry that NS card data can't be shown on
 * third-party fan sites — it can, with attribution, non-commercially, and
 * without reproducing NS-authored text or bypassing NS's access controls.
 */
export function NationStatesAttribution({ className }: { className?: string }) {
  return (
    <p className={`text-muted-foreground text-xs leading-relaxed ${className ?? ""}`}>
      Card data via the{" "}
      <a
        href="https://www.nationstates.net/page=api"
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-400 hover:text-blue-500"
      >
        NationStates API
      </a>. Nation flags remain the
      property of their authors. Not affiliated with or endorsed by NationStates.net.
    </p>
  );
}
