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
      const url = typeof window !== "undefined" ? window.location.href : `https://ixstats.com/id/@${cleanUsername}`;
      await navigator.clipboard.writeText(url);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {}
  }, [cleanUsername]);

  const realmName = featuredRealm?.name || "IxEarth";
  const passportNumber = `IX-${cleanUsername.toUpperCase().substring(0, 4)}-${data?.account?.userId ? data.account.userId.substring(0, 4).toUpperCase() : "882"}`;
  const entryDate = data?.account?.createdAt
    ? new Date(data.account.createdAt).toLocaleDateString("en-US", { month: "short", year: "numeric" }).toUpperCase()
    : "RECENT";

  const lorewards = data?.wiki?.lorewards;
  const work = data?.work;
  const history = data?.history;
  const forum = data?.forum;
  const vault = data?.vault;

  const loreCount = (work?.authoredArticles?.length ?? 0) + (work?.conlangs?.length ?? 0) + (work?.directives?.length ?? 0) + (work?.sportTeams?.length ?? 0) + (work?.wikiActivityFeed?.length ?? 0) || (work?.totalCreations ?? 0);

  // Replacement for Realms — not redundant with PRIMARY REALM grammar: show category diversity from vault
  const categorySummary = (() => {
    const top = (vault as any)?.topCards as Array<any> | undefined;
    if (!top || top.length === 0) return { label: "—", sub: "No categories yet" };
    const cats = top.map((c: any) => (c.card?.category ?? c.category) as string | null).filter((x): x is string => !!x && x !== "NS_IMPORT");
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
    { id: "history", index: "04", label: "History", icon: Clock, count: showHistoryStream ? (history?.length ?? 0) : 0 },
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
            "relative w-full rounded-3xl border border-black/10 dark:border-white/15 bg-card/70 dark:bg-card/60 backdrop-blur-[20px] saturate-[180%] shadow-2xl [backface-visibility:hidden]",
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
            <div className="p-5 sm:p-7 space-y-6">
              {/* Header: Clean Sovereign Masthead with Frosted IX Emblem */}
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-black/8 dark:border-white/10 pb-5">
                <div className="flex items-center gap-3">
                  <IxnayPassportSeal />
                  <div>
                    <div className="flex items-center gap-2">
                      <h1
                        className="font-mono text-xs sm:text-sm font-bold uppercase tracking-[0.14em] text-foreground"
                        style={{ fontOpticalSizing: "auto" } as React.CSSProperties}
                      >
                        IXSTATES PASSPORT
                      </h1>
                    </div>
                    <p className="font-mono text-[10px] tracking-wider text-muted-foreground uppercase">
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
                      className="inline-flex items-center gap-1.5 rounded-xl bg-foreground text-background px-4 py-2 text-xs font-semibold shadow-xs hover:opacity-90 active:scale-[0.96] transition-all duration-150 cursor-pointer"
                    >
                      <Settings className="h-3.5 w-3.5" />
                      <span>Edit Passport</span>
                    </button>
                  ) : (
                    <Link
                      href={`/messages?user=${encodeURIComponent(cleanUsername)}`}
                      data-cuelume-press="soft"
                      className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 text-white px-4 py-2 text-xs font-semibold shadow-xs hover:bg-blue-700 active:scale-[0.96] transition-all duration-150 cursor-pointer"
                    >
                      <Send className="h-3.5 w-3.5" />
                      <span>Send Message</span>
                    </Link>
                  )}

                  <button
                    type="button"
                    onClick={handleShareLink}
                    data-cuelume-press="soft"
                    className="inline-flex items-center gap-1.5 rounded-xl border border-black/10 dark:border-white/15 bg-black/[0.02] dark:bg-white/[0.03] px-3.5 py-2 text-xs font-semibold active:scale-[0.96] hover:bg-black/[0.05] dark:hover:bg-white/[0.05] transition-all duration-150 cursor-pointer"
                  >
                    {copiedLink ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Share2 className="h-3.5 w-3.5" />}
                    <span>{copiedLink ? "Copied" : "Share"}</span>
                  </button>
                </div>
              </div>

              {/* Identity & Overview Grid (Restrained Information Grammar) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Left: Unobstructed High-Res Portrait & Signature */}
                <div className="lg:col-span-4 flex flex-col items-center sm:items-start gap-3.5">
                  <div className="relative h-44 w-38 sm:h-52 sm:w-44 rounded-2xl border-2 border-black/15 dark:border-white/20 bg-muted overflow-hidden shadow-sm">
                    {highResAvatarUrl ? (
                      <img
                        src={highResAvatarUrl}
                        alt={displayName}
                        className="h-full w-full object-cover select-none transform-gpu"
                        loading="eager"
                        decoding="async"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-stone-200 dark:bg-stone-800 text-4xl font-bold text-stone-600 font-mono select-none">
                        {displayName.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>

                  <div className="w-full max-w-[175px] space-y-0.5 border-t border-black/15 dark:border-white/20 pt-1.5 text-center sm:text-left">
                    <span className="font-mono text-[8px] uppercase tracking-wider text-muted-foreground block">
                      SIGNATURE
                    </span>
                    <span className="font-serif italic text-sm tracking-wider text-foreground/90 font-medium select-none truncate block">
                      {signature || displayName}
                    </span>
                  </div>
                </div>

                {/* Right: Identity & 4-Cell Information Grammar Grid */}
                <div className="lg:col-span-8 space-y-4">
                  {/* Name, Handle & Role */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <h2 className="text-2xl font-bold text-foreground tracking-tight font-sans">
                        {displayName}
                      </h2>
                      <button
                        type="button"
                        onClick={handleCopyHandle}
                        className="inline-flex items-center gap-1 rounded-lg bg-black/5 dark:bg-white/5 px-2.5 py-1 text-xs font-semibold text-stone-600 dark:text-stone-300 hover:text-foreground hover:bg-black/10 transition-colors cursor-pointer font-mono"
                      >
                        <span>@{cleanUsername}</span>
                        {copiedHandle ? <Check className="h-2.5 w-2.5 text-emerald-500" /> : <Copy className="h-2.5 w-2.5" />}
                      </button>

                      {/* Authoritative User Role Badge */}
                      {roleName && (
                        <span className="rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/25 px-2.5 py-0.5 text-[11px] font-bold font-mono uppercase tracking-wider">
                          {roleName}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Information Grammar 4-Cell Matrix */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 border-y border-black/8 dark:border-white/10 py-3.5 font-mono text-xs">
                    <div>
                      <span className="text-[10px] text-muted-foreground uppercase block">IDENTITY NO.</span>
                      <strong className="text-foreground font-bold">{passportNumber}</strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-muted-foreground uppercase block">DATE JOINED</span>
                      <strong className="text-foreground font-bold">{entryDate}</strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-muted-foreground uppercase block">PRIMARY REALM</span>
                      <strong className="text-foreground font-bold">{realmName}</strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-muted-foreground uppercase block">STATUS</span>
                      <span className="text-emerald-500 font-bold">ACTIVE</span>
                    </div>
                  </div>

                  {/* Stat Overview Grid (Lorewards, Streak, Forum, Vault) */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {showAccolades && (
                      <button
                        type="button"
                        onClick={() => setIsLorewardsModalOpen(true)}
                        data-cuelume-press="soft"
                        className="rounded-xl border border-black/6 dark:border-white/8 bg-black/[0.02] dark:bg-white/[0.02] p-2.5 space-y-0.5 text-left hover:bg-black/[0.04] dark:hover:bg-white/[0.04] hover:border-amber-500/30 transition-all active:scale-[0.97] cursor-pointer group w-full"
                        title="Click to view Lorewards Civic Accolades"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-[9px] uppercase text-stone-400 group-hover:text-amber-500 transition-colors">
                            Lorewards
                          </span>
                          <Trophy className="h-3 w-3 text-amber-500" />
                        </div>
                        <p className="text-sm font-bold text-foreground">
                          {lorewards?.rank ? `#${lorewards.rank}` : "Unranked"}
                        </p>
                        <p className="font-mono text-[10px] text-amber-500">
                          {lorewards?.totalScore ? `${lorewards.totalScore.toLocaleString()} pts` : "0 pts"}
                        </p>
                      </button>
                    )}

                    {showImpact && (
                      <button
                        type="button"
                        onClick={() => onSelectTab("vault")}
                        data-cuelume-press="soft"
                        className="rounded-xl border border-black/6 dark:border-white/8 bg-black/[0.02] dark:bg-white/[0.02] p-2.5 space-y-0.5 text-left hover:bg-black/[0.04] dark:hover:bg-white/[0.04] active:scale-[0.97] transition-all cursor-pointer w-full"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-[9px] uppercase text-stone-400">Focus</span>
                          <Sparkles className="h-3 w-3 text-amber-500" />
                        </div>
                        <p className="text-sm font-bold text-foreground">{categorySummary.label}</p>
                        <p className="font-mono text-[10px] text-muted-foreground truncate">{categorySummary.sub}</p>
                      </button>
                    )}

                    {showForumStats && (
                      <div className="rounded-xl border border-black/6 dark:border-white/8 bg-black/[0.02] dark:bg-white/[0.02] p-2.5 space-y-0.5">
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-[9px] uppercase text-stone-400">Forum</span>
                          <MessageSquare className="h-3 w-3 text-blue-500" />
                        </div>
                        <p className="text-sm font-bold text-foreground">
                          {data?.forum?.messageCount ?? 0} Posts
                        </p>
                        <p className="font-mono text-[10px] text-muted-foreground">
                          {data?.forum?.reactionScore ?? 0} reactions
                        </p>
                      </div>
                    )}

                    {showVaultCards && (
                      <Link
                        href="/vault"
                        data-cuelume-press="soft"
                        className="rounded-xl border border-black/6 dark:border-white/8 bg-black/[0.02] dark:bg-white/[0.02] p-2.5 space-y-0.5 hover:bg-black/[0.04] dark:hover:bg-white/[0.04] active:scale-[0.97] transition-all cursor-pointer block"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-[9px] uppercase text-stone-400">IxCredits</span>
                          <IxCreditsSymbol className="h-3 w-3 text-amber-500" />
                        </div>
                        <p className="text-sm font-bold text-foreground flex items-center gap-1">
                          <IxCreditsSymbol className="h-3 w-3 shrink-0 text-amber-500" />
                          {(vault as any)?.credits?.toLocaleString?.() ?? "0"}
                        </p>
                        <p className="font-mono text-[10px] text-muted-foreground">
                          {(vault?.totalCards ?? 0).toLocaleString()} cards · Lv {vault?.collectorLevel ?? 1}
                        </p>
                      </Link>
                    )}
                  </div>

                  {/* ThinkPages Voice Bio (if available) */}
                  {data?.thinkpages?.bio && (
                    <div className="rounded-xl border border-black/6 dark:border-white/8 bg-black/[0.015] dark:bg-white/[0.02] p-3 space-y-1">
                      <div className="flex items-center gap-1.5 text-purple-500">
                        <Sparkles className="h-3 w-3" />
                        <span className="font-mono text-[9px] font-bold uppercase tracking-wider">ThinkPages Bio</span>
                      </div>
                      <p className="text-xs text-muted-foreground italic leading-relaxed">
                        "{data.thinkpages.bio}"
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 2. MID-CARD DIE-CUT INDEX RIBBON */}
            <div className="border-y border-black/10 dark:border-white/15 bg-black/[0.025] dark:bg-black/40 px-4 sm:px-6 py-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
                  {ribbonTabs.map((tab) => {
                    const isActive = activeTab === tab.id;
                    const Icon = tab.icon;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => onSelectTab(tab.id)}
                        data-cuelume-press="soft"
                        className={cn(
                          "flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all duration-150 active:scale-[0.97] cursor-pointer shrink-0",
                          isActive
                            ? "bg-stone-900 text-white dark:bg-white dark:text-stone-950 shadow-sm"
                            : "text-stone-600 dark:text-stone-400 hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5"
                        )}
                      >
                        <span className="font-mono text-[10px] opacity-60">{tab.index}.</span>
                        <Icon className="h-3.5 w-3.5" />
                        <span>{tab.label}</span>
                        {tab.count !== undefined && tab.count > 0 && (
                          <motion.span
                            key={`${tab.id}-${tab.count}`}
                            initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={
                              shouldReduceMotion
                                ? { duration: 0.15 }
                                : { type: "spring", bounce: 0, duration: 0.3 }
                            }
                            className="rounded-full bg-black/10 dark:bg-white/15 px-1.5 py-0.2 font-mono text-[9px]"
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
            <div className="p-5 sm:p-7 space-y-6 overscroll-contain" style={{ overscrollBehavior: "contain" } as React.CSSProperties}>
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
                    <PassportVaultTab vault={data?.vault} cleanUsername={cleanUsername} data={data} />
                  )}

                  {activeTab === "history" && (
                    <PassportHistoryTab history={showHistoryStream ? history : []} cleanUsername={cleanUsername} />
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
            "absolute inset-0 w-full min-h-full rounded-3xl border border-black/10 dark:border-white/15 bg-card/70 dark:bg-card/60 backdrop-blur-[20px] saturate-[180%] shadow-2xl p-6 sm:p-8 space-y-6 [backface-visibility:hidden] overflow-y-auto",
            !isFlipped ? "pointer-events-none" : ""
          )}
          style={
            shouldReduceMotion
              ? undefined
              : ({ transform: "rotateY(180deg)", willChange: "transform, opacity" } as React.CSSProperties)
          }
          animate={{ opacity: isFlipped ? 1 : 0 }}
          transition={shouldReduceMotion ? { duration: 0.2 } : { duration: 0.15 }}
        >
          <GuillochePattern opacity={0.05} />

          <div className="relative z-10 space-y-6">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/8 dark:border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <IxnayPassportSeal size="sm" />
                <div>
                  <span className="font-mono text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.2em] text-foreground block">
                    PASSPORT CONFIGURATION
                  </span>
                  <span className="font-mono text-[9px] tracking-wider text-muted-foreground uppercase">
                    SIGNATURE & PRIVACY CONTROLS
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsFlipped(false)}
                data-cuelume-press="soft"
                className="inline-flex items-center gap-1.5 rounded-xl bg-foreground text-background px-4 py-1.5 text-xs font-semibold shadow-xs hover:opacity-90 active:scale-[0.97] transition-all cursor-pointer"
              >
                <Check className="h-3.5 w-3.5 text-emerald-400" />
                <span>Done</span>
              </button>
            </div>

            {/* Signature Inscription & Telemetry Toggles Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Editable Signature Block */}
              <div className="rounded-2xl border border-black/8 dark:border-white/10 bg-black/[0.015] dark:bg-white/[0.02] p-5 space-y-3.5">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] uppercase font-bold text-stone-400 tracking-wider flex items-center gap-1.5">
                    <Edit3 className="h-3 w-3 text-blue-500" />
                    <span>Signature Inscription</span>
                  </span>
                  <span className="font-mono text-[9px] text-muted-foreground">Front Biometric Panel</span>
                </div>

                <div className="space-y-2">
                  <input
                    type="text"
                    value={signature}
                    onChange={(e) => setSignature(e.target.value)}
                    placeholder={displayName}
                    className="w-full rounded-xl border border-black/10 dark:border-white/15 bg-black/[0.02] dark:bg-white/[0.03] px-3.5 py-2 text-sm font-serif italic tracking-wide text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all"
                  />
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>Calligraphic Preview:</span>
                    <span className="font-serif italic text-foreground font-semibold">
                      {signature || displayName}
                    </span>
                  </div>
                </div>
              </div>

              {/* Telemetry Visibility Toggles */}
              <div className="rounded-2xl border border-black/8 dark:border-white/10 bg-black/[0.015] dark:bg-white/[0.02] p-5 space-y-3.5">
                <span className="font-mono text-[10px] uppercase font-bold text-stone-400 tracking-wider block">
                  Passport Visibility Toggles
                </span>

                <div className="space-y-3 text-xs">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <p className="font-semibold text-foreground">Civic Accolades</p>
                      <p className="text-[11px] text-muted-foreground">Show Lorewards score & rank</p>
                    </div>
                    <Switch checked={showAccolades} onCheckedChange={setShowAccolades} />
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-black/6 dark:border-white/8">
                    <div className="space-y-0.5">
                      <p className="font-semibold text-foreground">Focus</p>
                      <p className="text-[11px] text-muted-foreground">Show category breadth</p>
                    </div>
                    <Switch checked={showImpact} onCheckedChange={setShowImpact} />
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-black/6 dark:border-white/8">
                    <div className="space-y-0.5">
                      <p className="font-semibold text-foreground">Forum Discussions</p>
                      <p className="text-[11px] text-muted-foreground">Show message & reaction counters</p>
                    </div>
                    <Switch checked={showForumStats} onCheckedChange={setShowForumStats} />
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-black/6 dark:border-white/8">
                    <div className="space-y-0.5">
                      <p className="font-semibold text-foreground">IxCredits</p>
                      <p className="text-[11px] text-muted-foreground">Show IxCredits & collection</p>
                    </div>
                    <Switch checked={showVaultCards} onCheckedChange={setShowVaultCards} />
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-black/6 dark:border-white/8">
                    <div className="space-y-0.5">
                      <p className="font-semibold text-foreground">Activity History</p>
                      <p className="text-[11px] text-muted-foreground">Allow public activity stream</p>
                    </div>
                    <Switch checked={showHistoryStream} onCheckedChange={setShowHistoryStream} />
                  </div>
                </div>
              </div>
            </div>

            {/* Action Footer */}
            <div className="pt-2 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsFlipped(false)}
                data-cuelume-press="soft"
                className="inline-flex items-center gap-2 rounded-xl bg-foreground text-background px-5 py-2.5 text-xs font-semibold shadow-md hover:opacity-90 active:scale-[0.97] transition-all cursor-pointer"
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
