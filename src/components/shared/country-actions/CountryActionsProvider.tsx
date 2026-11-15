"use client";

import { createContext, use, useState } from "react";
import dynamic from "next/dynamic";
import { api } from "~/trpc/react";
import { useUser } from "~/context/auth-context";

/** A nation a link points at: its id when the caller has it, else its slug; the rest fills in from the server. */
export interface CountryTarget {
  id?: string;
  slug?: string | null;
  name?: string;
  realmId?: string | null;
}

const OpenCountryActions = createContext<(target: CountryTarget) => void>(() => undefined);

/** Opens the country actions sheet for a nation, from anywhere under the provider. */
export const useOpenCountryActions = () => use(OpenCountryActions);

// Loaded on the first open: the sheet and its detail modals stay out of every page's first bundle.
const CountryActionsMenu = dynamic(
  () =>
    import("~/components/mycountry/dossier/CountryActionsMenu").then((m) => ({
      default: m.CountryActionsMenu,
    })),
  { ssr: false }
);

/**
 * One country actions sheet for the whole app: every country link opens it (owner ruling 2026-11-13), so a
 * nation's card is the same wherever its name is tapped. The target stays mounted after closing so the
 * sheet can animate out.
 */
export function CountryActionsProvider({ children }: { children: React.ReactNode }) {
  const [sheet, setSheet] = useState<{ target: CountryTarget | null; open: boolean }>({
    target: null,
    open: false,
  });

  return (
    <OpenCountryActions value={(target) => setSheet({ target, open: true })}>
      {children}
      {sheet.target && (
        <CountryActionsSheet
          target={sheet.target}
          open={sheet.open}
          onClose={() => setSheet((s) => ({ ...s, open: false }))}
        />
      )}
    </OpenCountryActions>
  );
}

function CountryActionsSheet({
  target,
  open,
  onClose,
}: {
  target: CountryTarget;
  open: boolean;
  onClose: () => void;
}) {
  const { user } = useUser();
  const { data: profile } = api.users.getProfile.useQuery(undefined, {
    enabled: !!user?.id,
    staleTime: 5 * 60_000,
  });
  const ref = target.id ?? target.slug ?? "";
  // The same query the sheet makes, so it is one request: it resolves a slug and supplies the realm.
  const { data: country } = api.countries.getByIdBasic.useQuery({ id: ref }, { enabled: !!ref });
  const id = target.id ?? country?.id;
  if (!id) return null;

  const viewerCountryId = profile?.countryId?.trim() || undefined;
  return (
    <CountryActionsMenu
      targetCountryId={id}
      targetCountryName={target.name ?? country?.name ?? ""}
      targetRealmId={target.realmId ?? country?.realmId}
      viewerCountryId={viewerCountryId}
      isOwnCountry={!!viewerCountryId && viewerCountryId === id}
      isOpen={open}
      onClose={onClose}
    />
  );
}
