"use client";

import React, { useState } from "react";
import {
  UserPlus,
  UserXmark,
  ChatBubble,
  Calendar,
  ShareIos,
  City,
  Community,
  Shield,
  ScaleFrameEnlarge,
  Tournament,
  NavArrowDown,
  NavArrowRight,
  Page,
  Map,
  EditPencil,
} from "iconoir-react";
import { useRouter } from "next/navigation";
import { editorHref, MYCOUNTRY_MAP_EDITOR_PATH } from "~/lib/mycountry/routes";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { useCountryDiplomacyActions } from "./useCountryDiplomacyActions";
import { SAME_REALM_MESSAGE } from "~/lib/realms/same-realm";
import { cn, createUrl } from "~/lib/utils";
import { Button, buttonVariants } from "~/components/ui/button";
import { ProposeSummitForm } from "./ProposeSummitForm";
import type { HeroModal } from "~/components/shared/country-hero/HeroSnapshotPanels";
import { HeroDetailModal } from "~/components/shared/country-hero/CountryHeroCard";
import type { PolicyState } from "~/lib/diplomacy/pair-standing";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "~/components/ui/alert-dialog";
import { Sheet, SheetContent } from "~/components/ui/sheet";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "~/components/ui/collapsible";
import { dismissButtonClassName } from "~/components/ui/dialog";
import {
  destinationsFor,
  type IconType,
  OpenIn,
  PosterHeader,
  QuickAction,
  type Tone,
  ToneTile,
  VitalityStrip,
} from "./CountryActionsHeader";

interface CountryActionsMenuProps {
  targetCountryId: string;
  targetCountryName: string;
  /** The target's realm, when known: its diplomacy rows need the viewer's nation in the same realm. */
  targetRealmId?: string | null;
  viewerCountryId?: string;
  isOpen: boolean;
  onClose: () => void;
  isOwnCountry?: boolean;
}

type DiplomacyActions = ReturnType<typeof useCountryDiplomacyActions>;
type ForeignPolicy = Parameters<DiplomacyActions["proposeForeignPolicy"]>[0];

const MANAGEMENT_LINKS: Array<[icon: IconType, label: string, path: string, tone: Tone]> = [
  [City, "Dashboard", "/mycountry", "yellow"],
  [Page, "Executive", "/mycountry/executive", "orange"],
  [Community, "Diplomacy", "/mycountry/diplomacy", "green"],
  [EditPencil, "Editor", editorHref("identity"), "blue"],
  [Map, "Map editor", MYCOUNTRY_MAP_EDITOR_PATH, "teal"],
  [ScaleFrameEnlarge, "Politics", "/mycountry/politics", "cyan"],
];

/** Where every act's result is kept: proposals, agreements, embassies and measures in force. */
const DIPLOMACY_PATH = "/mycountry/diplomacy";

/**
 * One act on another nation, as MyCountry keeps it. `area` names the MyCountry area its result lands
 * in; `effect` is what the confirmation tells the player before they commit.
 */
interface Act {
  policy: ForeignPolicy;
  icon: IconType;
  tone: Tone;
  area: string;
  /** "Free trade": the agreement's name, in a sentence's middle as lower case. */
  noun: string;
  /** The open row's verb: "Propose free trade". */
  verb: string;
  effect: string;
}

const PROPOSALS: Act[] = [
  {
    policy: "free_trade",
    icon: Community,
    tone: "green",
    area: "Economy",
    noun: "Free trade",
    verb: "Propose free trade",
    effect:
      "Their leader decides. If they accept, both economies grow, phased in over four years, and relations warm.",
  },
  {
    policy: "military_alliance",
    icon: Shield,
    tone: "cyan",
    area: "Diplomacy",
    noun: "Military alliance",
    verb: "Propose military alliance",
    effect:
      "Their leader decides. If they accept, relations rise sharply and both economies gain a small lift.",
  },
];

const PRESSURE_EFFECT =
  "It takes effect at once, with no consent needed: both economies take the hit, phased in over four years, and relations cool. You can lift it later from your diplomacy inbox.";

const PRESSURE: Act[] = [
  {
    policy: "sanction",
    icon: ScaleFrameEnlarge,
    tone: "red",
    area: "Economy",
    noun: "Sanctions",
    verb: "Impose sanctions",
    effect: PRESSURE_EFFECT,
  },
  {
    policy: "embargo",
    icon: Tournament,
    tone: "red",
    area: "Economy",
    noun: "Embargo",
    verb: "Declare embargo",
    effect: PRESSURE_EFFECT,
  },
];

/** What a row says once something already stands: each opens the diplomacy view where it is kept. */
function standingLabel(act: Act, state: Exclude<PolicyState, "open">, targetName: string) {
  if (state === "active") return `${act.noun} in force`;
  if (state === "proposed") return `${act.noun} proposed`;
  return `Answer ${targetName}'s ${act.noun.toLowerCase()} offer`;
}

const profileUrl = (slugOrId: string) =>
  `${window.location.origin}${createUrl(`/countries/${slugOrId}`)}`;

export function CountryActionsMenu({
  targetCountryId,
  targetCountryName,
  targetRealmId,
  viewerCountryId,
  isOpen,
  onClose,
  isOwnCountry = false,
}: CountryActionsMenuProps) {
  const notify = useNotify();
  const router = useRouter();
  const [summitOpen, setSummitOpen] = useState(false);
  const [detail, setDetail] = useState<HeroModal | null>(null);

  const diplomacy = useCountryDiplomacyActions({
    viewerCountryId,
    targetCountryId,
    targetCountryName,
    targetRealmId,
    // The sheet stays open after an act so its row shows the new standing.
    followStatusEnabled: !!viewerCountryId && !isOwnCountry && isOpen,
  });
  const { data: detailRings } = api.countries.getActivityRingsData.useQuery(
    { countryId: targetCountryId },
    { enabled: detail === "vitality", staleTime: 5 * 60_000 }
  );
  const { data: facts } = api.countries.getByIdBasic.useQuery(
    { id: targetCountryId },
    { enabled: isOpen }
  );

  const go = (path: string) => {
    router.push(path);
    onClose();
  };

  // The system share sheet where there is one, else the link on the clipboard.
  const share = () => {
    const url = profileUrl(facts?.slug ?? targetCountryId);
    if (navigator.share) {
      void navigator.share({ title: targetCountryName, url }).catch(() => undefined);
      return;
    }
    void navigator.clipboard.writeText(url).then(() => notify.success("Link copied"));
  };

  // An act in flight locks the rows so nothing is double-submitted.
  const needsViewer = !viewerCountryId || diplomacy.isPending;
  // Country-to-country actions need both nations in one realm; following and messages stay open.
  const needsSameRealm = needsViewer || diplomacy.crossRealm;

  return (
    <>
      <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <SheetContent className="flex flex-col gap-6 overflow-y-auto">
          <PosterHeader
            countryId={targetCountryId}
            name={targetCountryName}
            isOwnCountry={isOwnCountry}
            enabled={isOpen}
            onNavigate={onClose}
          >
            {!isOwnCountry && (
              <div className="grid grid-cols-3 gap-1">
                <QuickAction
                  icon={diplomacy.isFollowing ? UserXmark : UserPlus}
                  label={diplomacy.isFollowing ? "Unfollow" : "Follow"}
                  tone={diplomacy.isFollowing ? "gray" : "blue"}
                  onClick={diplomacy.toggleFollow}
                  disabled={needsViewer}
                />
                <QuickAction
                  icon={ChatBubble}
                  label="Message"
                  tone="teal"
                  onClick={() => go(`/messages?country=${encodeURIComponent(targetCountryId)}`)}
                  disabled={!viewerCountryId}
                />
                <QuickAction
                  icon={Calendar}
                  label="Summit"
                  tone="yellow"
                  onClick={() => setSummitOpen((open) => !open)}
                  disabled={needsSameRealm}
                  pressed={summitOpen}
                />
              </div>
            )}
            <VitalityStrip countryId={targetCountryId} enabled={isOpen} onOpen={setDetail} />
          </PosterHeader>

          {/* Beside Close, in the sheet's own corner, as on a Maps place card. */}
          <button
            type="button"
            onClick={share}
            aria-label={`Share ${targetCountryName}`}
            title="Share"
            className={cn(dismissButtonClassName, "right-13")}
          >
            <ShareIos />
          </button>

          {summitOpen && !isOwnCountry && (
            <ProposeSummitForm
              targetCountryId={targetCountryId}
              targetCountryName={targetCountryName}
              onDone={() => setSummitOpen(false)}
            />
          )}

          {isOwnCountry && (
            <section aria-labelledby="country-manage" className="space-y-2">
              <h3 id="country-manage" className="text-subhead text-label-secondary px-1">
                Manage
              </h3>
              <div className="grid grid-cols-3 gap-1">
                {MANAGEMENT_LINKS.map(([icon, label, path, tone]) => (
                  <QuickAction
                    key={path}
                    icon={icon}
                    label={label}
                    tone={tone}
                    onClick={() => go(path)}
                  />
                ))}
              </div>
            </section>
          )}

          <OpenIn
            destinations={destinationsFor(targetCountryId, targetCountryName, facts ?? null)}
            onNavigate={onClose}
          />

          {!isOwnCountry && (
            <section aria-labelledby="country-mycountry" className="space-y-2">
              <h3 id="country-mycountry" className="text-subhead text-label-secondary px-1">
                MyCountry
              </h3>
              {diplomacy.crossRealm && (
                <p className="text-label-secondary text-footnote px-1">
                  {SAME_REALM_MESSAGE} for embassies, summits and proposals.
                </p>
              )}
              {diplomacy.standing.hasEmbassy ? (
                <StandingRow
                  icon={City}
                  tone="orange"
                  label="Embassy open"
                  area="Diplomacy"
                  onClick={() => go(DIPLOMACY_PATH)}
                />
              ) : (
                <ConfirmActionRow
                  icon={City}
                  tone="orange"
                  label={diplomacy.isEmbassyPending ? "Constructing…" : "Construct embassy"}
                  area="Diplomacy"
                  title={`Open an embassy in ${targetCountryName}?`}
                  description="It joins your embassy network in MyCountry Diplomacy, where you staff it and send its missions."
                  confirmLabel="Construct embassy"
                  onConfirm={diplomacy.establishEmbassy}
                  disabled={needsSameRealm}
                />
              )}
              {PROPOSALS.map((act) => (
                <ActRow
                  key={act.policy}
                  act={act}
                  state={diplomacy.standing.policy(act.policy)}
                  targetCountryName={targetCountryName}
                  title={`${act.verb} to ${targetCountryName}?`}
                  confirmLabel="Propose"
                  onConfirm={() => diplomacy.proposeForeignPolicy(act.policy)}
                  onOpenStanding={() => go(DIPLOMACY_PATH)}
                  disabled={needsSameRealm}
                />
              ))}
              <PressureActions
                targetCountryName={targetCountryName}
                standing={diplomacy.standing.policy}
                onConfirm={diplomacy.proposeForeignPolicy}
                onOpenStanding={() => go(DIPLOMACY_PATH)}
                disabled={needsSameRealm}
              />
            </section>
          )}

          {!viewerCountryId && !isOwnCountry && (
            <p className="border-separator text-label-secondary text-footnote border-t pt-4 text-center">
              Sign in with a nation to follow, message or open diplomacy.
            </p>
          )}

          {/* Inside the sheet, so the sheet stays open beneath it. */}
          {detail && (
            <HeroDetailModal
              modal={detail}
              countryId={targetCountryId}
              countryName={targetCountryName}
              ringData={detailRings}
              onClose={() => setDetail(null)}
            />
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}

/** Action rows: large (44px) bordered Facet buttons, label-aligned. */
const ACTION_ROW_CLASS = "w-full justify-start gap-3 pl-2";

/** The MyCountry area the row's result lands in, as a trailing detail. */
function AreaDetail({ area }: { area: string }) {
  return <span className="text-footnote text-label-secondary ml-auto font-normal">{area}</span>;
}

/** Something already stands between the nations: the row says so and opens where MyCountry keeps it. */
function StandingRow({
  icon,
  tone,
  label,
  area,
  onClick,
}: {
  icon: IconType;
  tone: Tone;
  label: string;
  area: string;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="lg"
      onClick={onClick}
      className={ACTION_ROW_CLASS}
    >
      <ToneTile icon={icon} tone={tone} />
      {label}
      <AreaDetail area={area} />
      <NavArrowRight aria-hidden className="text-label-tertiary mr-1 size-4" />
    </Button>
  );
}

/** An act that changes MyCountry: its row asks first, saying what will happen. */
function ConfirmActionRow({
  icon,
  tone,
  label,
  area,
  title,
  description,
  confirmLabel,
  destructive = false,
  onConfirm,
  disabled,
}: {
  icon: IconType;
  tone: Tone;
  label: string;
  area: string;
  title: string;
  description: string;
  confirmLabel: string;
  destructive?: boolean;
  onConfirm: () => void;
  disabled: boolean;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="lg"
          disabled={disabled}
          className={cn(ACTION_ROW_CLASS, destructive && "text-destructive")}
        >
          <ToneTile icon={icon} tone={tone} />
          {label}
          <AreaDetail area={area} />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className={buttonVariants({ variant: destructive ? "destructive" : "default" })}
            onClick={onConfirm}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** A foreign-policy act: offered while nothing stands, otherwise its standing. */
function ActRow({
  act,
  state,
  targetCountryName,
  title,
  confirmLabel,
  destructive,
  onConfirm,
  onOpenStanding,
  disabled,
}: {
  act: Act;
  state: PolicyState;
  targetCountryName: string;
  title: string;
  confirmLabel: string;
  destructive?: boolean;
  onConfirm: () => void;
  onOpenStanding: () => void;
  disabled: boolean;
}) {
  if (state !== "open") {
    return (
      <StandingRow
        icon={act.icon}
        tone={act.tone}
        label={standingLabel(act, state, targetCountryName)}
        area={act.area}
        onClick={onOpenStanding}
      />
    );
  }
  return (
    <ConfirmActionRow
      icon={act.icon}
      tone={act.tone}
      label={act.verb}
      area={act.area}
      title={title}
      description={act.effect}
      confirmLabel={confirmLabel}
      destructive={destructive}
      onConfirm={onConfirm}
      disabled={disabled}
    />
  );
}

/** Sanctions and embargoes sit one deliberate step deeper, and each still asks before it takes effect. */
function PressureActions({
  targetCountryName,
  standing,
  onConfirm,
  onOpenStanding,
  disabled,
}: {
  targetCountryName: string;
  standing: (policy: ForeignPolicy) => PolicyState;
  onConfirm: (policy: ForeignPolicy) => void;
  onOpenStanding: () => void;
  disabled: boolean;
}) {
  return (
    <Collapsible className="group/pressure">
      <CollapsibleTrigger
        className={cn(
          buttonVariants({ variant: "ghost", size: "lg" }),
          ACTION_ROW_CLASS,
          "text-label-secondary"
        )}
      >
        <ToneTile icon={Tournament} tone="red" />
        Pressure
        <AreaDetail area="Economy" />
        <NavArrowDown
          aria-hidden
          className="duration-fast size-4 transition-[rotate] group-data-[state=open]/pressure:rotate-180"
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-2 pt-2">
        {PRESSURE.map((act) => (
          <ActRow
            key={act.policy}
            act={act}
            state={standing(act.policy)}
            targetCountryName={targetCountryName}
            title={`${act.verb} on ${targetCountryName}?`}
            confirmLabel={act.verb}
            destructive
            onConfirm={() => onConfirm(act.policy)}
            onOpenStanding={onOpenStanding}
            disabled={disabled}
          />
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}
