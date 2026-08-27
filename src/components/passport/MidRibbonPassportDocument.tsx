"use client";

import React, { useState, useCallback } from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import Link from "next/link";
import {
  Check,
  Copy,
  Settings,
  Send,
  ShareAndroid as Share2,
  Globe,
  Trophy,
  Clock,
  Crown,
  ChatBubble as MessageSquare,
  Spark as Sparkles,
  RotateCameraLeft as RotateCcw,
  EditPencil as Edit3,
} from "iconoir-react";
import { IxCreditsSymbol } from "~/components/vault/IxCreditsSymbol";
import { cn } from "~/lib/utils";
import { Switch } from "~/components/ui/switch";
import { GuillochePattern } from "./cards/GuillochePattern";
import { IxnayPassportSeal } from "./cards/IxnayPassportSeal";
import { PassportRealmsTab } from "./tabs/PassportRealmsTab";
import { PassportLoreTab } from "./tabs/PassportLoreTab";
import { PassportHistoryTab } from "./tabs/PassportHistoryTab";
import { PassportVaultTab } from "./tabs/PassportVaultTab";
import { PassportLorewardsModal } from "./modals/PassportLorewardsModal";
import type { PassportTabType, UnifiedProfilePayload, RealmItem } from "./types";

interface MidRibbonPassportDocumentProps {
  cleanUsername: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  data: UnifiedProfilePayload;
  realms: RealmItem[];
  isOwner: boolean;
  activeTab: PassportTabType;
  onSelectTab: (tab: PassportTabType) => void;
}

/**
 * Upscales Clerk and CDN avatar URLs to crisp Retina/4K resolutions.
 */
function getHighResolutionAvatar(url: string | null, size = 600): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (
      parsed.hostname.includes("clerk.com") ||
      parsed.hostname.includes("clerk.dev") ||
      parsed.hostname.includes("img.clerk.com")
    ) {
      parsed.searchParams.set("width", String(size));
      parsed.searchParams.set("height", String(size));
      parsed.searchParams.set("quality", "100");
      parsed.searchParams.set("fit", "crop");
      return parsed.toString();
    }
    return url;
  } catch {
    return url;
  }
}

export function MidRibbonPassportDocument({
  cleanUsername,
  displayName,
  avatarUrl,
  bio: _bio,
  data,
  realms,
  isOwner,
  activeTab,
  onSelectTab,
}: MidRibbonPassportDocumentProps) {
  const [copiedHandle, setCopiedHandle] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isLorewardsModalOpen, setIsLorewardsModalOpen] = useState(false);
  const shouldReduceMotion = useReducedMotion();

  const featuredRealm = realms.find((r) => r.isFeatured) || realms[0] || null;

  // Authoritative Role from Database / Admin / Clerk
  const roleName = data?.account?.roleName || featuredRealm?.role || "Leader";

  // High-Resolution Avatar for physical passport biometric rendering
  const highResAvatarUrl = getHighResolutionAvatar(avatarUrl, 800);

  // Editable Signature State
  const [signature, setSignature] = useState(displayName);

  // Passport presentation & privacy preferences
  const [showAccolades, setShowAccolades] = useState(true);
  const [showImpact, setShowImpact] = useState(true);
  const [showForumStats, setShowForumStats] = useState(true);
  const [showVaultCards, setShowVaultCards] = useState(true);
  const [showHistoryStream, setShowHistoryStream] = useState(true);

  const handleCopyHandle = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(`@${cleanUsername}`);
      setCopiedHandle(true);
      setTimeout(() => setCopiedHandle(false), 2000);
    } catch {}
  }, [cleanUsername]);

  const handleShareLink = useCallback(async () => {
    try {
      const url =
        typeof window !== "undefined"
          ? window.location.href
          : `https://ixstats.com/id/@${cleanUsername}`;
      await navigator.clipboard.writeText(url);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {}
  }, [cleanUsername]);

  const realmName = featuredRealm?.name || "IxEarth";
  const passportNumber = `IX-${cleanUsername.toUpperCase().substring(0, 4)}-${data?.account?.userId ? data.account.userId.substring(0, 4).toUpperCase() : "882"}`;
  const entryDate = data?.account?.createdAt
    ? new Date(data.account.createdAt)
        .toLocaleDateString("en-US", { month: "short", year: "numeric" })
        .toUpperCase()
    : "RECENT";

  const lorewards = data?.wiki?.lorewards;
  const work = data?.work;
  const history = data?.history;
  const forum = data?.forum;
  const vault = data?.vault;

  const loreCount =
    (work?.authoredArticles?.length ?? 0) +
      (work?.conlangs?.length ?? 0) +
      (work?.directives?.length ?? 0) +
      (work?.sportTeams?.length ?? 0) +
      (work?.wikiActivityFeed?.length ?? 0) ||
    (work?.totalCreations ?? 0);

  // Replacement for Realms — not redundant with PRIMARY REALM grammar: show category diversity from vault
  const categorySummary = (() => {
    const top = (vault as any)?.topCards as Array<any> | undefined;
    if (!top || top.length === 0) return { label: "—", sub: "No categories yet" };
    const cats = top
      .map((c: any) => (c.card?.category ?? c.category) as string | null)
      .filter((x): x is string => !!x && x !== "NS_IMPORT");
    const distinct = new Set(cats).size;
    const topCat = cats[0] ?? null;
    const label = distinct ? `${distinct}/12` : "—";
    const sub = topCat ? `${topCat.charAt(0) + topCat.slice(1).toLowerCase()} focus` : "Collecting";
    return { label, sub };
  })();

  const ribbonTabs: Array<{
    id: PassportTabType;
    index: string;
    label: string;
    icon: typeof Globe;
    count?: number;
  }> = [
    { id: "realms", index: "01", label: "Realms", icon: Globe, count: realms.length },
    { id: "lore", index: "02", label: "Lore", icon: Trophy, count: loreCount },
    { id: "vault", index: "03", label: "Vault", icon: Crown, count: data?.vault?.totalCards ?? 0 },
    {
      id: "history",
      index: "04",
      label: "History",
      icon: Clock,
      count: showHistoryStream ? (history?.length ?? 0) : 0,
    },
  ];

  // Apple §4 springs: flip is interruptible, from presentation value
  const flipTransition = shouldReduceMotion
    ? { duration: 0.2, ease: "easeOut" as const }
    : { type: "spring" as const, bounce: 0, duration: 0.4 };

  return (
    <div className="relative w-full" style={{ perspective: 1800 }}>
      <motion.div
        className="relative w-full"
        style={{ transformStyle: "preserve-3d", willChange: "transform" } as React.CSSProperties}
        animate={{ rotateY: shouldReduceMotion ? 0 : isFlipped ? 180 : 0 }}
        transition={flipTransition}
      >
        {/* ========================================================================= */}
        {/* FRONT FACE OF THE PASSPORT                                               */}
        {/* ========================================================================= */}
        <motion.div
          className={cn(
            // Apple §12 Materials: translucent layer, not opaque bar — content scrolls under, weight encodes hierarchy
            "bg-card/70 dark:bg-card/60 relative w-full rounded-3xl border border-black/10 shadow-2xl saturate-[180%] backdrop-blur-[20px] [backface-visibility:hidden] dark:border-white/15",
            "supports-[backdrop-filter:blur(0)]:bg-card/85",
            isFlipped ? "pointer-events-none opacity-0" : "opacity-100"
          )}
          style={{ willChange: shouldReduceMotion ? undefined : "opacity" }}
          animate={{ opacity: isFlipped ? 0 : 1 }}
          transition={shouldReduceMotion ? { duration: 0.2 } : { duration: 0.15 }}
        >
          <GuillochePattern opacity={0.06} />

          <div className="relative z-10">
            {/* 1. TOP IDENTITY & OVERVIEW CARD SECTION */}
            <div className="space-y-6 p-5 sm:p-7">
              {/* Header: Clean Sovereign Masthead with Frosted IX Emblem */}
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-black/8 pb-5 dark:border-white/10">
                <div className="flex items-center gap-3">
                  <IxnayPassportSeal />
                  <div>
                    <div className="flex items-center gap-2">
                      <h1
                        className="text-foreground font-mono text-xs font-bold tracking-[0.14em] uppercase sm:text-sm"
                        style={{ fontOpticalSizing: "auto" } as React.CSSProperties}
                      >
                        IXSTATES PASSPORT
                      </h1>
                    </div>
                    <p className="text-muted-foreground font-mono text-[10px] tracking-wider uppercase">
                      USER IDENTITY
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  {isOwner ? (
                    <button
                      type="button"
                      onClick={() => setIsFlipped(true)}
                      data-cuelume-press="soft"
                      className="bg-foreground text-background inline-flex cursor-pointer items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold shadow-xs transition-all duration-150 hover:opacity-90 active:scale-[0.96]"
                    >
                      <Settings className="h-3.5 w-3.5" />
                      <span>Edit Passport</span>
                    </button>
                  ) : (
                    <Link
                      href={`/messages?user=${encodeURIComponent(cleanUsername)}`}
                      data-cuelume-press="soft"
                      className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-xs transition-all duration-150 hover:bg-blue-700 active:scale-[0.96]"
                    >
                      <Send className="h-3.5 w-3.5" />
                      <span>Send Message</span>
                    </Link>
                  )}

                  <button
                    type="button"
                    onClick={handleShareLink}
                    data-cuelume-press="soft"
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-black/10 bg-black/[0.02] px-3.5 py-2 text-xs font-semibold transition-all duration-150 hover:bg-black/[0.05] active:scale-[0.96] dark:border-white/15 dark:bg-white/[0.03] dark:hover:bg-white/[0.05]"
                  >
                    {copiedLink ? (
                      <Check className="h-3.5 w-3.5 text-emerald-500" />
                    ) : (
                      <Share2 className="h-3.5 w-3.5" />
                    )}
                    <span>{copiedLink ? "Copied" : "Share"}</span>
                  </button>
                </div>
              </div>

              {/* Identity & Overview Grid (Restrained Information Grammar) */}
              <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
                {/* Left: Unobstructed High-Res Portrait & Signature */}
                <div className="flex flex-col items-center gap-3.5 sm:items-start lg:col-span-4">
                  <div className="bg-muted relative h-44 w-38 overflow-hidden rounded-2xl border-2 border-black/15 shadow-sm sm:h-52 sm:w-44 dark:border-white/20">
                    {highResAvatarUrl ? (
                      <img
                        src={highResAvatarUrl}
                        alt={displayName}
                        className="h-full w-full transform-gpu object-cover select-none"
                        loading="eager"
                        decoding="async"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-stone-200 font-mono text-4xl font-bold text-stone-600 select-none dark:bg-stone-800">
                        {displayName.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>

                  <div className="w-full max-w-[175px] space-y-0.5 border-t border-black/15 pt-1.5 text-center sm:text-left dark:border-white/20">
                    <span className="text-muted-foreground block font-mono text-[8px] tracking-wider uppercase">
                      SIGNATURE
                    </span>
                    <span className="text-foreground/90 block truncate font-serif text-sm font-medium tracking-wider italic select-none">
                      {signature || displayName}
                    </span>
                  </div>
                </div>

                {/* Right: Identity & 4-Cell Information Grammar Grid */}
                <div className="space-y-4 lg:col-span-8">
                  {/* Name, Handle & Role */}
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <h2 className="text-foreground font-sans text-2xl font-bold tracking-tight">
                        {displayName}
                      </h2>
                      <button
                        type="button"
                        onClick={handleCopyHandle}
                        className="hover:text-foreground inline-flex cursor-pointer items-center gap-1 rounded-lg bg-black/5 px-2.5 py-1 font-mono text-xs font-semibold text-stone-600 transition-colors hover:bg-black/10 dark:bg-white/5 dark:text-stone-300"
                      >
                        <span>@{cleanUsername}</span>
                        {copiedHandle ? (
                          <Check className="h-2.5 w-2.5 text-emerald-500" />
                        ) : (
                          <Copy className="h-2.5 w-2.5" />
                        )}
                      </button>

                      {/* Authoritative User Role Badge */}
                      {roleName && (
                        <span className="rounded-lg border border-blue-500/25 bg-blue-500/10 px-2.5 py-0.5 font-mono text-[11px] font-bold tracking-wider text-blue-600 uppercase dark:text-blue-400">
                          {roleName}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Information Grammar 4-Cell Matrix */}
                  <div className="grid grid-cols-2 gap-3 border-y border-black/8 py-3.5 font-mono text-xs sm:grid-cols-4 dark:border-white/10">
                    <div>
                      <span className="text-muted-foreground block text-[10px] uppercase">
                        IDENTITY NO.
                      </span>
                      <strong className="text-foreground font-bold">{passportNumber}</strong>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[10px] uppercase">
                        DATE JOINED
                      </span>
                      <strong className="text-foreground font-bold">{entryDate}</strong>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[10px] uppercase">
                        PRIMARY REALM
                      </span>
                      <strong className="text-foreground font-bold">{realmName}</strong>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[10px] uppercase">
                        STATUS
                      </span>
                      <span className="font-bold text-emerald-500">ACTIVE</span>
                    </div>
                  </div>

                  {/* Stat Overview Grid (Lorewards, Streak, Forum, Vault) */}
                  <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                    {showAccolades && (
                      <button
                        type="button"
                        onClick={() => setIsLorewardsModalOpen(true)}
                        data-cuelume-press="soft"
                        className="group w-full cursor-pointer space-y-0.5 rounded-xl border border-black/6 bg-black/[0.02] p-2.5 text-left transition-all hover:border-amber-500/30 hover:bg-black/[0.04] active:scale-[0.97] dark:border-white/8 dark:bg-white/[0.02] dark:hover:bg-white/[0.04]"
                        title="Click to view Lorewards Civic Accolades"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-[9px] text-stone-400 uppercase transition-colors group-hover:text-amber-500">
                            Lorewards
                          </span>
                          <Trophy className="h-3 w-3 text-amber-500" />
                        </div>
                        <p className="text-foreground text-sm font-bold">
                          {lorewards?.rank ? `#${lorewards.rank}` : "Unranked"}
                        </p>
                        <p className="font-mono text-[10px] text-amber-500">
                          {lorewards?.totalScore
                            ? `${lorewards.totalScore.toLocaleString()} pts`
                            : "0 pts"}
                        </p>
                      </button>
                    )}

                    {showImpact && (
                      <button
                        type="button"
                        onClick={() => onSelectTab("vault")}
                        data-cuelume-press="soft"
                        className="w-full cursor-pointer space-y-0.5 rounded-xl border border-black/6 bg-black/[0.02] p-2.5 text-left transition-all hover:bg-black/[0.04] active:scale-[0.97] dark:border-white/8 dark:bg-white/[0.02] dark:hover:bg-white/[0.04]"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-[9px] text-stone-400 uppercase">
                            Focus
                          </span>
                          <Sparkles className="h-3 w-3 text-amber-500" />
                        </div>
                        <p className="text-foreground text-sm font-bold">{categorySummary.label}</p>
                        <p className="text-muted-foreground truncate font-mono text-[10px]">
                          {categorySummary.sub}
                        </p>
                      </button>
                    )}

                    {showForumStats && (
                      <div className="space-y-0.5 rounded-xl border border-black/6 bg-black/[0.02] p-2.5 dark:border-white/8 dark:bg-white/[0.02]">
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-[9px] text-stone-400 uppercase">
                            Forum
                          </span>
                          <MessageSquare className="h-3 w-3 text-blue-500" />
                        </div>
                        <p className="text-foreground text-sm font-bold">
                          {data?.forum?.messageCount ?? 0} Posts
                        </p>
                        <p className="text-muted-foreground font-mono text-[10px]">
                          {data?.forum?.reactionScore ?? 0} reactions
                        </p>
                      </div>
                    )}

                    {showVaultCards && (
                      <Link
                        href="/vault"
                        data-cuelume-press="soft"
                        className="block cursor-pointer space-y-0.5 rounded-xl border border-black/6 bg-black/[0.02] p-2.5 transition-all hover:bg-black/[0.04] active:scale-[0.97] dark:border-white/8 dark:bg-white/[0.02] dark:hover:bg-white/[0.04]"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-[9px] text-stone-400 uppercase">
                            IxCredits
                          </span>
                          <IxCreditsSymbol className="h-3 w-3 text-amber-500" />
                        </div>
                        <p className="text-foreground flex items-center gap-1 text-sm font-bold">
                          <IxCreditsSymbol className="h-3 w-3 shrink-0 text-amber-500" />
                          {(vault as any)?.credits?.toLocaleString?.() ?? "0"}
                        </p>
                        <p className="text-muted-foreground font-mono text-[10px]">
                          {(vault?.totalCards ?? 0).toLocaleString()} cards · Lv{" "}
                          {vault?.collectorLevel ?? 1}
                        </p>
                      </Link>
                    )}
                  </div>

                  {/* ThinkPages Voice Bio (if available) */}
                  {data?.thinkpages?.bio && (
                    <div className="space-y-1 rounded-xl border border-black/6 bg-black/[0.015] p-3 dark:border-white/8 dark:bg-white/[0.02]">
                      <div className="flex items-center gap-1.5 text-purple-500">
                        <Sparkles className="h-3 w-3" />
                        <span className="font-mono text-[9px] font-bold tracking-wider uppercase">
                          ThinkPages Bio
                        </span>
                      </div>
                      <p className="text-muted-foreground text-xs leading-relaxed italic">
                        "{data.thinkpages.bio}"
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 2. MID-CARD DIE-CUT INDEX RIBBON */}
            <div className="border-y border-black/10 bg-black/[0.025] px-4 py-2.5 sm:px-6 dark:border-white/15 dark:bg-black/40">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex scrollbar-none items-center gap-1.5 overflow-x-auto">
                  {ribbonTabs.map((tab) => {
                    const isActive = activeTab === tab.id;
                    const Icon = tab.icon;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => onSelectTab(tab.id)}
                        data-cuelume-press="soft"
                        className={cn(
                          "flex shrink-0 cursor-pointer items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all duration-150 active:scale-[0.97]",
                          isActive
                            ? "bg-stone-900 text-white shadow-sm dark:bg-white dark:text-stone-950"
                            : "hover:text-foreground text-stone-600 hover:bg-black/5 dark:text-stone-400 dark:hover:bg-white/5"
                        )}
                      >
                        <span className="font-mono text-[10px] opacity-60">{tab.index}.</span>
                        <Icon className="h-3.5 w-3.5" />
                        <span>{tab.label}</span>
                        {tab.count !== undefined && tab.count > 0 && (
                          <motion.span
                            key={`${tab.id}-${tab.count}`}
                            initial={
                              shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.8 }
                            }
                            animate={{ opacity: 1, scale: 1 }}
                            transition={
                              shouldReduceMotion
                                ? { duration: 0.15 }
                                : { type: "spring", bounce: 0, duration: 0.3 }
                            }
                            className="py-0.2 rounded-full bg-black/10 px-1.5 font-mono text-[9px] dark:bg-white/15"
                            style={{ willChange: "transform, opacity" }}
                          >
                            {tab.count}
                          </motion.span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* 3. LOWER TAB BODY CONTENT — Apple §4 spring, §9 rubber-band, §11 will-change */}
            <div
              className="space-y-6 overscroll-contain p-5 sm:p-7"
              style={{ overscrollBehavior: "contain" } as React.CSSProperties}
            >
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
                  animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
                  exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
                  transition={
                    shouldReduceMotion
                      ? { duration: 0.15, ease: "easeOut" }
                      : { type: "spring", bounce: 0, duration: 0.35 }
                  }
                  style={{ willChange: shouldReduceMotion ? undefined : "transform, opacity" }}
                >
                  {activeTab === "realms" && (
                    <PassportRealmsTab realms={realms} cleanUsername={cleanUsername} />
                  )}

                  {(activeTab === "lore" || activeTab === "work" || activeTab === "wiki") && (
                    <PassportLoreTab work={work} wiki={data?.wiki} cleanUsername={cleanUsername} />
                  )}

                  {activeTab === "vault" && (
                    <PassportVaultTab
                      vault={data?.vault}
                      cleanUsername={cleanUsername}
                      data={data}
                    />
                  )}

                  {activeTab === "history" && (
                    <PassportHistoryTab
                      history={showHistoryStream ? history : []}
                      cleanUsername={cleanUsername}
                    />
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </motion.div>

        {/* ========================================================================= */}
        {/* BACK FACE OF THE PASSPORT (CONFIGURATION & PRIVACY CONTROLS)               */}
        {/* ========================================================================= */}
        <motion.div
          className={cn(
            "bg-card/70 dark:bg-card/60 absolute inset-0 min-h-full w-full space-y-6 overflow-y-auto rounded-3xl border border-black/10 p-6 shadow-2xl saturate-[180%] backdrop-blur-[20px] [backface-visibility:hidden] sm:p-8 dark:border-white/15",
            !isFlipped ? "pointer-events-none" : ""
          )}
          style={
            shouldReduceMotion
              ? undefined
              : ({
                  transform: "rotateY(180deg)",
                  willChange: "transform, opacity",
                } as React.CSSProperties)
          }
          animate={{ opacity: isFlipped ? 1 : 0 }}
          transition={shouldReduceMotion ? { duration: 0.2 } : { duration: 0.15 }}
        >
          <GuillochePattern opacity={0.05} />

          <div className="relative z-10 space-y-6">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/8 pb-4 dark:border-white/10">
              <div className="flex items-center gap-3">
                <IxnayPassportSeal size="sm" />
                <div>
                  <span className="text-foreground block font-mono text-[10px] font-bold tracking-[0.2em] uppercase sm:text-[11px]">
                    PASSPORT CONFIGURATION
                  </span>
                  <span className="text-muted-foreground font-mono text-[9px] tracking-wider uppercase">
                    SIGNATURE & PRIVACY CONTROLS
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsFlipped(false)}
                data-cuelume-press="soft"
                className="bg-foreground text-background inline-flex cursor-pointer items-center gap-1.5 rounded-xl px-4 py-1.5 text-xs font-semibold shadow-xs transition-all hover:opacity-90 active:scale-[0.97]"
              >
                <Check className="h-3.5 w-3.5 text-emerald-400" />
                <span>Done</span>
              </button>
            </div>

            {/* Signature Inscription & Telemetry Toggles Grid */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {/* Editable Signature Block */}
              <div className="space-y-3.5 rounded-2xl border border-black/8 bg-black/[0.015] p-5 dark:border-white/10 dark:bg-white/[0.02]">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 font-mono text-[10px] font-bold tracking-wider text-stone-400 uppercase">
                    <Edit3 className="h-3 w-3 text-blue-500" />
                    <span>Signature Inscription</span>
                  </span>
                  <span className="text-muted-foreground font-mono text-[9px]">
                    Front Biometric Panel
                  </span>
                </div>

                <div className="space-y-2">
                  <input
                    type="text"
                    value={signature}
                    onChange={(e) => setSignature(e.target.value)}
                    placeholder={displayName}
                    className="text-foreground placeholder:text-muted-foreground w-full rounded-xl border border-black/10 bg-black/[0.02] px-3.5 py-2 font-serif text-sm tracking-wide italic transition-all focus:ring-2 focus:ring-blue-500/30 focus:outline-none dark:border-white/15 dark:bg-white/[0.03]"
                  />
                  <div className="text-muted-foreground flex items-center justify-between text-[11px]">
                    <span>Calligraphic Preview:</span>
                    <span className="text-foreground font-serif font-semibold italic">
                      {signature || displayName}
                    </span>
                  </div>
                </div>
              </div>

              {/* Telemetry Visibility Toggles */}
              <div className="space-y-3.5 rounded-2xl border border-black/8 bg-black/[0.015] p-5 dark:border-white/10 dark:bg-white/[0.02]">
                <span className="block font-mono text-[10px] font-bold tracking-wider text-stone-400 uppercase">
                  Passport Visibility Toggles
                </span>

                <div className="space-y-3 text-xs">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <p className="text-foreground font-semibold">Civic Accolades</p>
                      <p className="text-muted-foreground text-[11px]">
                        Show Lorewards score & rank
                      </p>
                    </div>
                    <Switch checked={showAccolades} onCheckedChange={setShowAccolades} />
                  </div>

                  <div className="flex items-center justify-between border-t border-black/6 pt-2 dark:border-white/8">
                    <div className="space-y-0.5">
                      <p className="text-foreground font-semibold">Focus</p>
                      <p className="text-muted-foreground text-[11px]">Show category breadth</p>
                    </div>
                    <Switch checked={showImpact} onCheckedChange={setShowImpact} />
                  </div>

                  <div className="flex items-center justify-between border-t border-black/6 pt-2 dark:border-white/8">
                    <div className="space-y-0.5">
                      <p className="text-foreground font-semibold">Forum Discussions</p>
                      <p className="text-muted-foreground text-[11px]">
                        Show message & reaction counters
                      </p>
                    </div>
                    <Switch checked={showForumStats} onCheckedChange={setShowForumStats} />
                  </div>

                  <div className="flex items-center justify-between border-t border-black/6 pt-2 dark:border-white/8">
                    <div className="space-y-0.5">
                      <p className="text-foreground font-semibold">IxCredits</p>
                      <p className="text-muted-foreground text-[11px]">
                        Show IxCredits & collection
                      </p>
                    </div>
                    <Switch checked={showVaultCards} onCheckedChange={setShowVaultCards} />
                  </div>

                  <div className="flex items-center justify-between border-t border-black/6 pt-2 dark:border-white/8">
                    <div className="space-y-0.5">
                      <p className="text-foreground font-semibold">Activity History</p>
                      <p className="text-muted-foreground text-[11px]">
                        Allow public activity stream
                      </p>
                    </div>
                    <Switch checked={showHistoryStream} onCheckedChange={setShowHistoryStream} />
                  </div>
                </div>
              </div>
            </div>

            {/* Action Footer */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsFlipped(false)}
                data-cuelume-press="soft"
                className="bg-foreground text-background inline-flex cursor-pointer items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-semibold shadow-md transition-all hover:opacity-90 active:scale-[0.97]"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Return to Passport</span>
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>

      {/* Interactive Lorewards Civic Accolades Modal */}
      <PassportLorewardsModal
        open={isLorewardsModalOpen}
        onOpenChange={setIsLorewardsModalOpen}
        wiki={data?.wiki}
        cleanUsername={cleanUsername}
      />
    </div>
  );
}
