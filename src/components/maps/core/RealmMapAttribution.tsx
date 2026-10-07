"use client";

/**
 * The credit line a realm's map shows: the realm's own (`Realm.settings.map.attribution`), else its source
 * sync's (e.g. a community map its borders come from). `realms.map.display` resolves which; nothing when
 * neither is set.
 */
export function RealmMapAttribution({ text }: { text: string | null | undefined }) {
  if (!text) return null;
  return (
    <p
      className="bg-surface text-label-secondary text-caption rounded-control pointer-events-auto max-w-full px-2 py-1"
      data-testid="realm-map-attribution"
    >
      {text}
    </p>
  );
}
