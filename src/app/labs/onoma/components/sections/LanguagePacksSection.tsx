"use client";

// src/app/labs/onoma/components/sections/LanguagePacksSection.tsx
// Onoma Lab — Community Language Packs (Linguistic Models, Phonology Sets, & Dictionaries)
// Layout: Tactile 3D Vault-Style Pack Cards · Apple Spring Physics · Emil Kowalski Craft Polish

import { useState, useMemo } from "react";
import Link from "next/link";
import { Search, RefreshCw, Sparkles, ExternalLink, X, BookOpen, Volume2 } from "lucide-react";
import {
  RiBookMarkedLine,
  RiGitForkLine,
  RiStarFill,
  RiTranslate2,
  RiSoundModuleLine,
  RiStore2Line,
} from "react-icons/ri";
import { FacetMaterial } from "~/components/ui/facet";
import { LanguagePackCard, type LanguagePack } from "../shared/LanguagePackCard";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";

const FAMILIES = [
  { value: "any", label: "All Language Families" },
  { value: "latin", label: "Latin / Roman" },
  { value: "germanic", label: "Germanic / Norse" },
  { value: "celtic", label: "Celtic / Gaelic" },
  { value: "slavic", label: "Slavic / Eastern European" },
  { value: "arabic", label: "Arabic / Semitic" },
  { value: "east-asian", label: "East Asian" },
  { value: "austronesian", label: "Austronesian" },
  { value: "persian", label: "Persian / Iranian" },
  { value: "turkic", label: "Turkic" },
  { value: "african", label: "African" },
  { value: "indic", label: "Indic" },
  { value: "uralic", label: "Uralic" },
  { value: "constructed", label: "Constructed Conlang" },
];

export function LanguagePacksSection({
  onLoadToStudio,
}: {
  onLoadToStudio?: (title: string, words: string[]) => void;
}) {
  const notify = useNotify();
  const utils = api.useUtils();

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [familyFilter, setFamilyFilter] = useState("any");

  // Selection & Inspector State
  const [selectedPackId, setSelectedPackId] = useState<string | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<"rules" | "lexicon" | "reviews">("rules");

  // Review Form state
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");

  // Queries
  const {
    data: marketplaceData,
    isLoading,
    refetch,
  } = api.onoma.list.useQuery({
    search: searchQuery || undefined,
    culturalFamily: familyFilter !== "any" ? familyFilter : undefined,
  });

  const forkMutation = api.onoma.fork.useMutation({
    onSuccess: (data) => {
      notify.success("Language pack successfully forked into your local studio!");
      void utils.onoma.list.invalidate();
      if (data && onLoadToStudio && Array.isArray((data as any).lexiconSeed)) {
        onLoadToStudio((data as any).name || "Forked Pack", (data as any).lexiconSeed);
      }
    },
    onError: (err) => {
      notify.error(`Failed to fork language pack: ${err.message}`);
    },
  });

  const rateMutation = api.onoma.rate.useMutation({
    onSuccess: () => {
      notify.success("Your rating has been submitted.");
      setReviewComment("");
      void utils.onoma.list.invalidate();
    },
    onError: (err) => {
      notify.error(`Failed to submit review: ${err.message}`);
    },
  });

  const activePack = useMemo(() => {
    if (!selectedPackId || !marketplaceData) return null;
    return marketplaceData.packs.find((p) => p.id === selectedPackId) || null;
  }, [selectedPackId, marketplaceData]);

  const handleFork = (pack: LanguagePack) => {
    forkMutation.mutate({ packId: pack.id });
  };

  const handleSubmitReview = (packId: string) => {
    rateMutation.mutate({
      packId,
      rating: reviewRating,
      comment: reviewComment || undefined,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header & Vault Bridge Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-foreground text-xl font-bold tracking-tight">
              Community Language Packs
            </h2>
            <Badge
              variant="outline"
              className="border-orange-500/30 bg-orange-500/10 text-orange-500 text-[10px] font-mono font-bold"
            >
              EXPLORE
            </Badge>
          </div>
          <p className="text-muted-foreground mt-1 text-xs sm:text-sm">
            Discover, inspect, and fork complete linguistic models, phonological rule sets, and seed dictionaries.
          </p>
        </div>

        {/* IxVault Platform Marketplace Bridge Link */}
        <Link
          href="/vault/marketplace?tab=store"
          className="group flex items-center gap-2 rounded-xl border border-border/50 bg-secondary/20 hover:bg-secondary/35 px-3.5 py-2 text-xs font-semibold backdrop-blur-md transition-all active:scale-95 shrink-0"
        >
          <RiStore2Line className="h-4 w-4 text-amber-500" />
          <span className="text-foreground">Browse on IxVault</span>
          <ExternalLink className="h-3 w-3 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </Link>
      </div>

      {/* Toolbar: Search, Filters & Refresh */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="text-muted-foreground absolute top-2.5 left-3 h-4 w-4" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search language packs by name, culture, or tags..."
            className="bg-background/80 border-border/60 text-foreground placeholder:text-muted-foreground/60 w-full rounded-xl border py-2 pr-4 pl-9 text-xs font-medium focus:border-[#0091ff]/60 focus:outline-none backdrop-blur-md"
          />
        </div>

        <select
          value={familyFilter}
          onChange={(e) => setFamilyFilter(e.target.value)}
          className="bg-background/80 border-border/60 text-foreground rounded-xl border px-3 py-2 text-xs font-medium focus:border-[#0091ff]/60 focus:outline-none backdrop-blur-md cursor-pointer"
        >
          {FAMILIES.map((fam) => (
            <option key={fam.value} value={fam.value}>
              {fam.label}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={() => refetch()}
          className="border-border/60 bg-secondary/20 hover:bg-secondary/40 text-foreground flex cursor-pointer items-center justify-center rounded-xl border p-2 text-xs transition-all active:scale-95"
          title="Refresh Language Packs"
        >
          <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
        </button>
      </div>

      {/* Main Grid: Card Gallery on Left + Detail Drawer on Right if Selected */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
        {/* Gallery Column */}
        <div className={activePack ? "space-y-4 lg:col-span-7" : "space-y-4 lg:col-span-12"}>
          {isLoading ? (
            <div className="flex h-64 items-center justify-center">
              <RefreshCw className="text-muted-foreground h-6 w-6 animate-spin text-[#0091ff]" />
            </div>
          ) : !marketplaceData?.packs || marketplaceData.packs.length === 0 ? (
            <FacetMaterial material="satin" className="border-border/30 border p-12 text-center rounded-2xl">
              <RiBookMarkedLine className="text-muted-foreground mx-auto mb-3 h-12 w-12 opacity-30 text-[#0091ff]" />
              <h4 className="text-foreground text-sm font-bold">No Language Packs Found</h4>
              <p className="text-muted-foreground mt-1 text-xs">
                Try adjusting your search terms or language family filters.
              </p>
            </FacetMaterial>
          ) : (
            <div className={cn(
              "grid gap-4.5",
              activePack
                ? "grid-cols-1 sm:grid-cols-2"
                : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
            )}>
              {marketplaceData.packs.map((pack) => {
                const reviews = pack.reviews || [];
                const ratingCount = pack._count?.reviews ?? reviews.length;
                const ratingAvg = reviews.length
                  ? reviews.reduce((acc: number, r: { rating: number }) => acc + r.rating, 0) / reviews.length
                  : 0;
                const forkCount = pack._count?.forks ?? 0;

                const cardPack: LanguagePack = {
                  id: pack.id,
                  name: pack.name,
                  description: pack.description,
                  authorName: "Community Creator",
                  culturalFamily: pack.culturalFamily || "general",
                  ratingAvg,
                  ratingCount,
                  forkCount,
                  tags: pack.tags || [],
                };

                return (
                  <LanguagePackCard
                    key={pack.id}
                    pack={cardPack}
                    isSelected={pack.id === selectedPackId}
                    onSelect={() => setSelectedPackId(pack.id)}
                    onFork={() => handleFork(cardPack)}
                    isForking={forkMutation.isPending}
                  />
                );
              })}
            </div>
          )}
        </div>

        {/* Detailed Inspection Drawer */}
        {activePack && (
          <div className="space-y-4 lg:col-span-5 sticky top-6">
            <FacetMaterial material="satin" className="border-border/40 space-y-4 rounded-2xl border p-5 shadow-xl backdrop-blur-xl">
              {/* Drawer Header */}
              <div className="border-border/30 flex items-start justify-between border-b pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-foreground text-base font-extrabold">{activePack.name}</h3>
                    <Badge variant="outline" className="text-[9px] font-mono uppercase">
                      {activePack.culturalFamily || "General"}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    by @Community Creator
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedPackId(null)}
                  className="text-muted-foreground hover:text-foreground cursor-pointer rounded-lg p-1 hover:bg-secondary/40 transition-colors"
                  title="Close Inspector"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Sub-tabs Segmented Switcher */}
              <div className="bg-secondary/20 border-border/40 grid grid-cols-3 gap-1 rounded-xl border p-1 text-center text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setActiveSubTab("rules")}
                  className={cn(
                    "cursor-pointer rounded-lg py-1.5 transition-all",
                    activeSubTab === "rules"
                      ? "bg-background text-foreground shadow-xs font-bold border border-border/40"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Rules
                </button>
                <button
                  type="button"
                  onClick={() => setActiveSubTab("lexicon")}
                  className={cn(
                    "cursor-pointer rounded-lg py-1.5 transition-all",
                    activeSubTab === "lexicon"
                      ? "bg-background text-foreground shadow-xs font-bold border border-border/40"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Lexicon
                </button>
                <button
                  type="button"
                  onClick={() => setActiveSubTab("reviews")}
                  className={cn(
                    "cursor-pointer rounded-lg py-1.5 transition-all",
                    activeSubTab === "reviews"
                      ? "bg-background text-foreground shadow-xs font-bold border border-border/40"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Reviews ({activePack.ratingCount})
                </button>
              </div>

              {/* Tab 1: Rules & Phonology */}
              {activeSubTab === "rules" && (
                <div className="space-y-3 text-xs">
                  <p className="text-muted-foreground leading-relaxed">
                    {activePack.description || "No extended documentation provided."}
                  </p>

                  <div className="bg-background/60 border-border/40 space-y-2 rounded-xl border p-3 font-mono">
                    <div className="text-[10px] font-bold text-foreground uppercase">
                      Phonological Constraints
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div>
                        <span className="text-muted-foreground">Family: </span>
                        <span className="text-foreground capitalize">{activePack.culturalFamily}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Forks: </span>
                        <span className="text-foreground">{activePack.forkCount}</span>
                      </div>
                    </div>
                  </div>

                  <Button
                    type="button"
                    onClick={() => handleFork(activePack as any)}
                    disabled={forkMutation.isPending}
                    className="w-full bg-[#0091ff] hover:bg-[#33a7ff] text-white font-bold h-9 rounded-xl shadow-md"
                  >
                    <RiGitForkLine className="h-4 w-4 mr-1.5" />
                    <span>Fork Pack to My Studio</span>
                  </Button>
                </div>
              )}

              {/* Tab 2: Sample Lexicon */}
              {activeSubTab === "lexicon" && (
                <div className="space-y-3 text-xs">
                  <p className="text-muted-foreground">
                    Seed dictionary vocabulary provided with this language pack:
                  </p>
                  <div className="bg-background/60 border-border/40 max-h-48 overflow-y-auto rounded-xl border p-3 font-mono text-[11px] leading-relaxed text-foreground">
                    {Array.isArray((activePack as any).lexiconSeed) && (activePack as any).lexiconSeed.length > 0
                      ? (activePack as any).lexiconSeed.join(", ")
                      : "Lexicon seed words bundled in package."}
                  </div>
                </div>
              )}

              {/* Tab 3: Reviews */}
              {activeSubTab === "reviews" && (
                <div className="space-y-3.5 text-xs">
                  {/* Rating input */}
                  <div className="bg-background/60 border-border/40 space-y-2.5 rounded-xl border p-3">
                    <label className="font-bold text-foreground block">Leave a Community Rating</label>
                    <div className="flex items-center gap-1.5">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setReviewRating(star)}
                          className="cursor-pointer text-base transition-transform active:scale-110"
                        >
                          <RiStarFill
                            className={cn(
                              "h-4 w-4",
                              star <= reviewRating ? "text-amber-400 fill-amber-400" : "text-border"
                            )}
                          />
                        </button>
                      ))}
                      <span className="ml-2 font-mono font-bold text-amber-500">
                        {reviewRating}.0 / 5.0
                      </span>
                    </div>

                    <textarea
                      value={reviewComment}
                      onChange={(e) => setReviewComment(e.target.value)}
                      placeholder="Optional feedback about this language pack..."
                      rows={2}
                      className="border-border/60 bg-secondary/15 text-foreground placeholder:text-muted-foreground/60 w-full resize-none rounded-lg border p-2 text-xs focus:border-[#0091ff]/60 focus:outline-none"
                    />

                    <Button
                      type="button"
                      size="sm"
                      onClick={() => handleSubmitReview(activePack.id)}
                      disabled={rateMutation.isPending}
                      className="w-full bg-secondary text-foreground hover:bg-secondary/80 border border-border/50 h-8 rounded-lg font-semibold"
                    >
                      Submit Rating
                    </Button>
                  </div>
                </div>
              )}
            </FacetMaterial>
          </div>
        )}
      </div>
    </div>
  );
}

export default LanguagePacksSection;
