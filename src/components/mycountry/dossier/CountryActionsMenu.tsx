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
  Heart,
  NavArrowDown,
  Page,
  BookStack,
  Map,
  ProfileCircle,
  GraphUp,
  Crown,
  MultiplePages,
  EditPencil,
} from "iconoir-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { editorHref, MYCOUNTRY_MAP_EDITOR_PATH } from "~/lib/mycountry/routes";
import { api, type RouterInputs } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { useCountryDiplomacyActions } from "./useCountryDiplomacyActions";
import { SAME_REALM_MESSAGE } from "~/lib/realms/same-realm";
import { useViewerPostingAccount } from "~/hooks/useViewerPostingAccount";
import { cn, createUrl } from "~/lib/utils";
import { titleToWikiOSRoute } from "~/lib/wiki-os/transformers/url-compat";
import { nationHref } from "~/lib/exchange/routes";
import { handleProfileHref } from "~/lib/thinkpages-forum/links";
import { Button, buttonVariants, focusRing } from "~/components/ui/button";
import { ProposeSummitForm } from "./ProposeSummitForm";
import { UnifiedCountryFlag } from "~/components/shared/flags/UnifiedCountryFlag";
import { HealthRing } from "~/components/ui/health-ring";
import { heroRings, vitalityStanding } from "~/components/shared/country-hero/HeroSnapshotPanels";
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "~/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Card } from "~/components/ui/card";
import type { APP_IDS } from "~/lib/design/tokens";

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

type IconType = React.ComponentType<{ className?: string }>;
type DiplomacyActions = ReturnType<typeof useCountryDiplomacyActions>;
type ForeignPolicy = Parameters<DiplomacyActions["proposeForeignPolicy"]>[0];
type CongratulationPost = RouterInputs["thinkpages"]["createPost"];
type AppId = (typeof APP_IDS)[number];

/**
 * Each action's colour says what kind of act it is (social blue and teal, trade green, hostile red,
 * utilities grey), on a tile so the label stays neutral and readable in both themes.
 */
const TONES = {
  blue: "bg-blue/15 text-blue",
  teal: "bg-teal/15 text-teal",
  cyan: "bg-cyan/15 text-cyan",
  green: "bg-green/15 text-green",
  yellow: "bg-yellow/15 text-yellow",
  orange: "bg-orange/15 text-orange",
  pink: "bg-pink/15 text-pink",
  red: "bg-red/15 text-red",
  gray: "bg-fill-3 text-label-secondary",
} as const;

type Tone = keyof typeof TONES;

const MANAGEMENT_LINKS: Array<[icon: IconType, label: string, path: string, tone: Tone]> = [
  [City, "Dashboard", "/mycountry", "yellow"],
  [Page, "Executive", "/mycountry/executive", "orange"],
  [Community, "Diplomacy", "/mycountry/diplomacy", "green"],
  [EditPencil, "Editor", editorHref("identity"), "blue"],
  [Map, "Map editor", MYCOUNTRY_MAP_EDITOR_PATH, "teal"],
  [ScaleFrameEnlarge, "Politics", "/mycountry/politics", "cyan"],
];

const PROPOSALS: Array<[icon: IconType, label: string, policy: ForeignPolicy, tone: Tone]> = [
  [Community, "Propose free trade", "free_trade", "green"],
  [Shield, "Propose military alliance", "military_alliance", "cyan"],
];

const PRESSURE: Array<[icon: IconType, label: string, policy: ForeignPolicy]> = [
  [ScaleFrameEnlarge, "Impose sanctions", "sanction"],
  [Tournament, "Declare embargo", "embargo"],
];

/** One "Open in" destination: the app it opens wears that app's tint (`data-app`); `null` is neutral. */
interface Destination {
  label: string;
  href: string;
  icon: IconType;
  app: AppId | null;
}

interface CountryFacts {
  slug: string | null;
  realm: { slug: string; name: string } | null;
  ownerHandle: string | null;
}

/** Everywhere the nation lives across IxStates. Passport and Realm appear only when the nation has them. */
function destinationsFor(id: string, name: string, facts: CountryFacts | null): Destination[] {
  const list: Array<Destination | null> = [
    { label: "Profile", href: `/countries/${facts?.slug ?? id}`, icon: Page, app: "mycountry" },
    { label: "Wiki", href: titleToWikiOSRoute(name), icon: BookStack, app: "wiki" },
    {
      label: "Map",
      href: `/maps?country=${encodeURIComponent(id)}&name=${encodeURIComponent(name)}`,
      icon: Map,
      app: "maps",
    },
    facts?.ownerHandle
      ? {
          label: "Passport",
          href: handleProfileHref(facts.ownerHandle),
          icon: ProfileCircle,
          app: null,
        }
      : null,
    { label: "Exchange", href: nationHref(id), icon: GraphUp, app: "exchange" },
    facts?.realm
      ? { label: "Realm", href: `/r/${facts.realm.slug}`, icon: Crown, app: "realms" }
      : null,
    {
      label: "Cards",
      href: `/vault/cards/explore?country=${encodeURIComponent(id)}`,
      icon: MultiplePages,
      app: "vault",
    },
  ];
  return list.filter((d): d is Destination => d !== null);
}

const profileUrl = (slugOrId: string) =>
  `${window.location.origin}${createUrl(`/countries/${slugOrId}`)}`;

function ToneTile({
  icon: Icon,
  tone,
  size = "sm",
}: {
  icon: IconType;
  tone: Tone;
  size?: "sm" | "lg";
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid shrink-0 place-items-center",
        size === "lg" ? "size-11 rounded-full" : "rounded-control-sm size-7",
        TONES[tone]
      )}
    >
      <Icon className={size === "lg" ? "size-5" : "size-4"} />
    </span>
  );
}

/** Flag, name, vitality standing, realm, region and leader: who this nation is before what you can do. */
function IdentityHeader({
  countryId,
  name,
  isOwnCountry,
  enabled,
}: {
  countryId: string;
  name: string;
  isOwnCountry: boolean;
  enabled: boolean;
}) {
  const { data: country } = api.countries.getByIdBasic.useQuery({ id: countryId }, { enabled });
  const { data: rings } = api.countries.getActivityRingsData.useQuery(
    { countryId },
    { enabled, staleTime: 5 * 60_000 }
  );
  const standing = rings ? vitalityStanding(heroRings(rings)) : null;
  const place = country?.region ?? country?.continent ?? null;

  return (
    <SheetHeader data-content="entity" className="flex-row items-center gap-4 pr-10 text-left">
      <UnifiedCountryFlag
        showTooltip={false}
        countryName={name}
        flagUrl={country?.flagUrl}
        size="xl"
        className="rounded-control-sm shrink-0"
      />
      <div className="min-w-0 flex-1 space-y-1">
        <SheetTitle className="text-title-2 truncate">{name}</SheetTitle>
        <SheetDescription asChild>
          <div className="text-footnote text-label-secondary space-y-0.5">
            <div className="flex min-w-0 items-center gap-1.5">
              {standing && (
                <div className={cn("flex shrink-0 items-center gap-1.5", standing.color)}>
                  <HealthRing
                    value={standing.score}
                    size={14}
                    color="currentColor"
                    label="Vitality standing"
                  />
                  {standing.label}
                </div>
              )}
              {standing && place && <span aria-hidden>·</span>}
              {place && <span className="truncate">{place}</span>}
            </div>
            <p className="truncate">
              {[
                country?.realm?.name,
                isOwnCountry
                  ? "Your nation"
                  : country?.ownerHandle
                    ? `@${country.ownerHandle}`
                    : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
        </SheetDescription>
      </div>
    </SheetHeader>
  );
}

/** A round quick action under the header, like a contact card's. */
function QuickAction({
  icon,
  label,
  tone,
  onClick,
  disabled,
  pressed,
}: {
  icon: IconType;
  label: string;
  tone: Tone;
  onClick: () => void;
  disabled?: boolean;
  /** For a toggle (Summit opens its form in place). */
  pressed?: boolean;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={pressed}
      className="aria-pressed:bg-fill-4 h-auto flex-col gap-1.5 px-1 py-2"
    >
      <ToneTile icon={icon} tone={tone} size="lg" />
      <span className="text-caption text-label">{label}</span>
    </Button>
  );
}

/** "Open in": one tile per app the nation appears in, each in its app's tint. */
function OpenIn({
  destinations,
  onNavigate,
}: {
  destinations: Destination[];
  onNavigate: () => void;
}) {
  return (
    <section aria-labelledby="country-open-in" className="space-y-2">
      <h3 id="country-open-in" className="text-subhead text-label-secondary px-1">
        Open in
      </h3>
      <ul className="grid grid-cols-4 gap-1">
        {destinations.map((d) => (
          <li key={d.label}>
            <Link
              href={d.href}
              onClick={onNavigate}
              className={cn(
                "hover:bg-fill-4 rounded-control duration-fast flex flex-col items-center gap-1.5 px-1 py-2 transition-colors",
                focusRing
              )}
            >
              <span
                aria-hidden
                data-app={d.app ?? undefined}
                className={cn(
                  "rounded-control grid size-10 place-items-center",
                  d.app ? "bg-tint-fill text-tint-ink" : "bg-fill-3 text-label"
                )}
              >
                <d.icon className="size-5" />
              </span>
              <span className="text-caption text-label">{d.label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Pick a recent achievement and post a congratulation to the nation's feed. */
function CongratulateRow({
  targetCountryName,
  achievements,
  viewerCountryId,
  postingAccountId,
  disabled,
  sending,
  onSend,
}: {
  targetCountryName: string;
  achievements: Array<{ id: string; title: string; description?: string | null }>;
  viewerCountryId: string | undefined;
  /** The viewer's ThinkPages account that posts for their nation. */
  postingAccountId: string | null;
  /** Another action in the menu is in flight (the row's own sending state is `sending`). */
  disabled: boolean;
  sending: boolean;
  onSend: (post: CongratulationPost) => void;
}) {
  const notify = useNotify();
  const [selected, setSelected] = useState("");

  const congratulate = () => {
    if (!viewerCountryId) {
      notify.error("You need to sign in to send congratulations");
      return;
    }
    if (!postingAccountId) {
      notify.error("Create a ThinkPages account to post congratulations");
      return;
    }
    const achievement = achievements.find((a) => a.id === selected);
    if (!achievement) {
      notify.error("Please select an achievement to congratulate");
      return;
    }
    onSend({
      accountId: postingAccountId,
      content:
        `Congratulations to ${targetCountryName} on ${achievement.title}. ${achievement.description ?? ""}`.trim(),
      visibility: "public" as const,
      hashtags: ["achievement", targetCountryName.replace(/\s/g, "")],
    });
  };

  return (
    <Card variant="well" padding="none" className="flex flex-wrap items-center gap-3 p-2 pl-3">
      <ToneTile icon={Heart} tone="pink" />
      <Select value={selected} onValueChange={setSelected}>
        <SelectTrigger
          size="sm"
          className="text-footnote min-w-[140px] flex-1"
          aria-label="Achievement to congratulate"
        >
          <SelectValue placeholder="Congratulate on…" />
        </SelectTrigger>
        <SelectContent>
          {achievements.map((achievement) => (
            <SelectItem key={achievement.id} value={achievement.id}>
              {achievement.title}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        size="sm"
        variant="secondary"
        onClick={congratulate}
        disabled={!viewerCountryId || disabled || sending || !selected}
      >
        {sending ? "Sending…" : "Send"}
      </Button>
    </Card>
  );
}

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

  const diplomacy = useCountryDiplomacyActions({
    viewerCountryId,
    targetCountryId,
    targetCountryName,
    targetRealmId,
    followStatusEnabled: !!viewerCountryId && !isOwnCountry && isOpen,
    onProposed: onClose,
  });

  const congratulation = api.thinkpages.createPost.useMutation({
    onSuccess: () => {
      notify.success(`Congratulations sent to ${targetCountryName}`);
      onClose();
    },
    onError: (error) => notify.error(`Failed to send congratulations: ${error.message}`),
  });

  const postingAccountId = useViewerPostingAccount(viewerCountryId, isOpen && !isOwnCountry);

  const { data: recentAchievements } = api.achievements.getRecentByCountry.useQuery(
    { countryId: targetCountryId, limit: 5 },
    { enabled: isOpen && !isOwnCountry }
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

  // A sending congratulation also locks the diplomacy rows so nothing is double-submitted.
  const isBusy = diplomacy.isPending || congratulation.isPending;
  const needsViewer = !viewerCountryId || isBusy;
  // Country-to-country actions need both nations in one realm; following and messages stay open.
  const needsSameRealm = needsViewer || diplomacy.crossRealm;

  return (
    <>
      <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <SheetContent className="flex flex-col gap-6 overflow-y-auto">
          <IdentityHeader
            countryId={targetCountryId}
            name={targetCountryName}
            isOwnCountry={isOwnCountry}
            enabled={isOpen}
          />

          {isOwnCountry ? (
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
          ) : (
            <div className="space-y-2">
              <div className="grid grid-cols-4 gap-1">
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
                <QuickAction icon={ShareIos} label="Share" tone="gray" onClick={share} />
              </div>
              {summitOpen && (
                <ProposeSummitForm
                  targetCountryId={targetCountryId}
                  targetCountryName={targetCountryName}
                  onDone={() => setSummitOpen(false)}
                />
              )}
            </div>
          )}

          <OpenIn
            destinations={destinationsFor(targetCountryId, targetCountryName, facts ?? null)}
            onNavigate={onClose}
          />

          {!isOwnCountry && (
            <section aria-labelledby="country-diplomacy" className="space-y-2">
              <h3 id="country-diplomacy" className="text-subhead text-label-secondary px-1">
                Diplomacy
              </h3>
              {diplomacy.crossRealm && (
                <p className="text-label-secondary text-footnote px-1">
                  {SAME_REALM_MESSAGE} for embassies, summits and proposals.
                </p>
              )}
              <ActionRow
                icon={City}
                label={diplomacy.isEmbassyPending ? "Constructing…" : "Construct embassy"}
                tone="orange"
                onClick={diplomacy.establishEmbassy}
                disabled={needsSameRealm}
              />
              {PROPOSALS.map(([icon, label, policy, tone]) => (
                <ActionRow
                  key={policy}
                  icon={icon}
                  label={label}
                  tone={tone}
                  onClick={() => diplomacy.proposeForeignPolicy(policy)}
                  disabled={needsSameRealm}
                />
              ))}
              {recentAchievements && recentAchievements.length > 0 && (
                <CongratulateRow
                  targetCountryName={targetCountryName}
                  achievements={recentAchievements}
                  viewerCountryId={viewerCountryId}
                  postingAccountId={postingAccountId}
                  disabled={isBusy}
                  sending={congratulation.isPending}
                  onSend={congratulation.mutate}
                />
              )}
              <PressureActions
                targetCountryName={targetCountryName}
                onConfirm={diplomacy.proposeForeignPolicy}
                disabled={needsSameRealm}
              />
            </section>
          )}

          {!viewerCountryId && !isOwnCountry && (
            <p className="border-separator text-label-secondary text-footnote border-t pt-4 text-center">
              Sign in with a nation to follow, message or open diplomacy.
            </p>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}

/** Action rows: large (44px) bordered Facet buttons, label-aligned. */
const ACTION_ROW_CLASS = "w-full justify-start gap-3 pl-2";

/** One full-width action: a coloured icon tile and a neutral label. */
function ActionRow({
  icon,
  label,
  tone,
  onClick,
  disabled,
}: {
  icon: IconType;
  label: string;
  tone: Tone;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="lg"
      onClick={onClick}
      disabled={disabled}
      className={ACTION_ROW_CLASS}
    >
      <ToneTile icon={icon} tone={tone} />
      {label}
    </Button>
  );
}

/** Sanctions and embargoes sit one deliberate step deeper, and each still asks before it takes effect. */
function PressureActions({
  targetCountryName,
  onConfirm,
  disabled,
}: {
  targetCountryName: string;
  onConfirm: (policy: ForeignPolicy) => void;
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
        <NavArrowDown
          aria-hidden
          className="duration-fast ml-auto size-4 transition-[rotate] group-data-[state=open]/pressure:rotate-180"
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-2 pt-2">
        {PRESSURE.map(([icon, label, policy]) => (
          <HostileActionRow
            key={policy}
            icon={icon}
            label={label}
            targetCountryName={targetCountryName}
            onConfirm={() => onConfirm(policy)}
            disabled={disabled}
          />
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}

/** A sanction or embargo takes effect at once, so its row asks first. */
function HostileActionRow({
  icon,
  label,
  targetCountryName,
  onConfirm,
  disabled,
}: {
  icon: IconType;
  label: string;
  targetCountryName: string;
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
          className={cn(ACTION_ROW_CLASS, "text-destructive")}
        >
          <ToneTile icon={icon} tone="red" />
          {label}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {label} on {targetCountryName}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            It takes effect at once, with no consent needed: both economies take the hit, phased in
            over four years, and relations cool. You can lift it later from your diplomacy inbox.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className={buttonVariants({ variant: "destructive" })}
            onClick={onConfirm}
          >
            {label}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
