"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Clock, Map as MapIcon, OpenBook, Page, Settings } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";
import {
  DocumentRibbon,
  ribbonPanelId,
  ribbonTabId,
  type RibbonTab,
} from "~/components/shared/document/DocumentRibbon";
import { CountryActionsMenu } from "~/components/mycountry/dossier/CountryActionsMenu";
import { CountryBackFace } from "~/components/country-profile/CountryBackFace";
import { ProfileFace } from "~/components/country-profile/ProfileFace";
import { FactbookTab } from "~/components/country-profile/factbook/FactbookTab";
import { HistoryTab } from "~/components/country-profile/history/HistoryTab";
import { LoreReader } from "~/components/country-profile/lore/LoreReader";
import { MapTab } from "~/components/country-profile/map/MapTab";
import { useCountryTab } from "~/hooks/useCountryTab";
import { useUserCountry } from "~/hooks/useUserCountry";
import type { CountryTab } from "~/lib/country/country-routes";
import { REDUCED_MOTION_FADE, springSmooth } from "~/lib/design/motion";
import { cn } from "~/lib/utils/cn";
import { useCountryProfileLayer, type CountryProfileLayer } from "../_hooks/useCountryProfileLayer";
import { useProfileShell } from "./ProfileShellContext";

const TABS: readonly RibbonTab<CountryTab>[] = [
  { id: "factbook", label: "Factbook", icon: Page },
  { id: "map", label: "Map", icon: MapIcon },
  { id: "lore", label: "Lore", icon: OpenBook },
  { id: "history", label: "History", icon: Clock },
];

function Panel({ tab, layer }: { tab: CountryTab; layer: CountryProfileLayer }) {
  switch (tab) {
    case "map":
      return <MapTab layer={layer} />;
    case "lore":
      return <LoreReader layer={layer} />;
    case "history":
      return <HistoryTab layer={layer} />;
    default:
      return <FactbookTab layer={layer} />;
  }
}

/** The face and its back as one grid cell; only the face turns (the ribbon and panel stay put). */
function FlipFace({
  flipped,
  front,
  back,
}: {
  flipped: boolean;
  front: React.ReactNode;
  back: React.ReactNode;
}) {
  const side =
    "[grid-area:1/1] [backface-visibility:hidden] motion-reduce:transition-opacity motion-reduce:duration-150";
  return (
    <div style={{ perspective: 1800 }}>
      <div
        className={cn(
          "grid transition-transform duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)] transform-3d",
          "motion-reduce:[transform:none] motion-reduce:transition-none",
          flipped && "[transform:rotateY(180deg)]"
        )}
      >
        <div
          inert={flipped}
          className={cn(
            side,
            flipped && "motion-reduce:pointer-events-none motion-reduce:opacity-0"
          )}
        >
          {front}
        </div>
        <div
          inert={!flipped}
          className={cn(
            side,
            "[transform:rotateY(180deg)] motion-reduce:[transform:none]",
            !flipped && "motion-reduce:pointer-events-none motion-reduce:opacity-0"
          )}
        >
          {back}
        </div>
      </div>
    </div>
  );
}

function DocumentLoading() {
  return (
    <div className="space-y-6" role="status" aria-label="Loading profile">
      <Skeleton className="rounded-card h-80 w-full" />
      <Skeleton className="rounded-card h-[28rem] w-full" />
    </div>
  );
}

/**
 * CountryDocument — the country page as one document, like the passport: the face (map,
 * identity, figures, Country DNA; the owner turns it over with Manage), the ribbon (Factbook ·
 * Map · Lore · History) and one panel. Every tab page renders it; switching tabs is instant
 * (`history.pushState`, no route transition) and each tab keeps its own URL, with back and
 * forward followed through `popstate`.
 */
export function CountryDocument({ initialTab }: { initialTab: CountryTab }) {
  const { slug, country, flagUrl, isOwner, clock, cover } = useProfileShell();
  const layer = useCountryProfileLayer({ country, flagUrl, isOwner, clock });
  const { userProfile } = useUserCountry();
  const reduceMotion = useReducedMotion();
  const idBase = `country-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const { tab, navigate: selectTab } = useCountryTab(initialTab, slug);
  const [flipped, setFlipped] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const ribbonRef = useRef<HTMLDivElement>(null);
  const manageRef = useRef<HTMLButtonElement>(null);
  const wasFlipped = useRef(false);

  // The face that goes inert drops focus; on flip-back it returns to Manage.
  useEffect(() => {
    if (wasFlipped.current && !flipped) manageRef.current?.focus({ preventScroll: true });
    wasFlipped.current = flipped;
  }, [flipped]);

  const openMap = useCallback(() => {
    selectTab("map");
    ribbonRef.current?.scrollIntoView({
      behavior: reduceMotion ? "auto" : "smooth",
      block: "start",
    });
  }, [reduceMotion, selectTab]);

  if (!layer) return <DocumentLoading />;

  const action = isOwner ? (
    <Button ref={manageRef} variant="secondary" size="sm" onClick={() => setFlipped(true)}>
      <Settings aria-hidden />
      Manage
    </Button>
  ) : (
    <Button size="sm" onClick={() => setActionsOpen(true)}>
      Country actions
    </Button>
  );

  return (
    <Card className="overflow-hidden">
      <FlipFace
        flipped={flipped}
        front={<ProfileFace layer={layer} cover={cover} action={action} onExpandMap={openMap} />}
        back={
          isOwner ? (
            <CountryBackFace
              name={country.name.replace(/_/g, " ")}
              cover={cover}
              owner={layer.owner}
              onDone={() => setFlipped(false)}
            />
          ) : null
        }
      />
      <div ref={ribbonRef} className="scroll-mt-[calc(var(--shell-top-offset,5rem)+1rem)]">
        <DocumentRibbon
          tabs={TABS}
          activeTab={tab}
          onSelectTab={selectTab}
          idBase={idBase}
          label="Country sections"
        />
      </div>
      <div
        role="tabpanel"
        id={ribbonPanelId(idBase)}
        aria-labelledby={ribbonTabId(idBase, tab)}
        tabIndex={0}
        className="focus-visible:outline-tint p-4 focus-visible:outline-2 focus-visible:-outline-offset-2 sm:p-6"
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={tab}
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
            animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
            transition={reduceMotion ? REDUCED_MOTION_FADE : springSmooth}
          >
            <Panel tab={tab} layer={layer} />
          </motion.div>
        </AnimatePresence>
      </div>
      <CountryActionsMenu
        targetCountryId={country.id}
        targetCountryName={country.name}
        targetRealmId={clock.realmId}
        viewerCountryId={userProfile?.countryId ?? undefined}
        isOpen={actionsOpen}
        onClose={() => setActionsOpen(false)}
        isOwnCountry={isOwner}
      />
    </Card>
  );
}
