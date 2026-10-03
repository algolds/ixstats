"use client";

// src/app/labs/onoma/components/sections/LanguagePacksSection.tsx
// Onoma Lab — Community Language Packs (Linguistic Models, Phonology Sets, & Dictionaries)
// Layout: Tactile 3D Vault-Style Pack Cards · Apple Spring Physics · Emil Kowalski Craft Polish

import { useState, useMemo } from "react";
import Link from "next/link";
// oxlint-disable-next-line eslint/no-unused-vars
import {
  BookmarkBook,
  GitFork,
  OpenNewWindow as ExternalLink,
  Refresh as RefreshCw,
  Search,
  Star,
  Shop,
  Xmark as X,
} from "iconoir-react";
import { LanguagePackCard, type LanguagePack } from "../shared/LanguagePackCard";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { Button } from "~/components/ui/button";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Card } from "~/components/ui/card";

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
      if (data && onLoadToStudio) {
        const forked = data as { name?: string; lexiconSeed?: string[] };
        if (Array.isArray(forked.lexiconSeed)) {
          onLoadToStudio(forked.name || "Forked Pack", forked.lexiconSeed);
        }
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
      <div className="border-separator flex flex-col gap-4 border-b pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h2 className="text-label text-title-2 font-bold">Community Packs</h2>
          <p className="text-label-secondary text-footnote mt-0.5">
            Discover, inspect, and fork community conlang models, phonological rule sets, and seed
            dictionaries.
          </p>
        </div>

        {/* IxVault Platform Marketplace Bridge Link */}
        <Link
          href="/vault/marketplace?tab=store"
          className="group border-separator bg-fill-4 hover:bg-fill-3 rounded-row text-footnote flex shrink-0 items-center gap-2 border px-4 py-2 font-semibold transition-[color,background-color,border-color,box-shadow,opacity,transform] active:scale-95"
        >
          <Shop className="text-yellow h-4 w-4" />
          <span className="text-label">Browse on IxVault</span>
          <ExternalLink className="text-label-secondary h-3 w-3 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </Link>
      </div>

      {/* Toolbar: Search, Filters & Refresh */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="text-label-secondary absolute top-2 left-3 h-4 w-4" />
          <Input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search language packs by name, culture, or tags..."
            className="text-footnote w-full pr-4 pl-9 font-medium"
          />
        </div>

        <Select value={familyFilter} onValueChange={(v) => setFamilyFilter(v)}>
          <SelectTrigger size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FAMILIES.map((fam) => (
              <SelectItem key={fam.value} value={fam.value}>
                {fam.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          variant="outline"
          size="sm"
          type="button"
          onClick={() => refetch()}
          className="justify-center"
          title="Refresh Language Packs"
        >
          <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
        </Button>
      </div>

      {/* Main Grid: Card Gallery on Left + Detail Drawer on Right if Selected */}
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
        {/* Gallery Column */}
        <div className={activePack ? "space-y-4 lg:col-span-7" : "space-y-4 lg:col-span-12"}>
          {isLoading ? (
            <div className="flex h-64 items-center justify-center">
              <RefreshCw className="text-label-secondary text-tint h-6 w-6 animate-spin" />
            </div>
          ) : !marketplaceData?.packs || marketplaceData.packs.length === 0 ? (
            <Card variant="inset" padding="none" className="p-12 text-center">
              <BookmarkBook className="text-label-secondary text-tint mx-auto mb-3 h-12 w-12 opacity-30" />
              <h4 className="text-label text-body font-semibold">No Language Packs Found</h4>
              <p className="text-label-secondary text-footnote mt-1">
                Try adjusting your search terms or language family filters.
              </p>
            </Card>
          ) : (
            <div
              className={cn(
                "grid gap-5",
                activePack
                  ? "grid-cols-1 sm:grid-cols-2"
                  : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
              )}
            >
              {marketplaceData.packs.map((pack) => {
                const reviews = pack.reviews || [];
                const ratingCount = pack._count?.reviews ?? reviews.length;
                const ratingAvg = reviews.length
                  ? reviews.reduce((acc: number, r: { rating: number }) => acc + r.rating, 0) /
                    reviews.length
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
          <div className="sticky top-(--shell-top-offset) space-y-4 lg:col-span-5">
            <Card variant="inset" padding="none" className="space-y-4 p-5">
              {/* Drawer Header */}
              <div className="border-separator flex items-start justify-between border-b pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-label text-body font-semibold">{activePack.name}</h3>
                    <Badge variant="outline" className="text-eyebrow font-mono">
                      {activePack.culturalFamily || "General"}
                    </Badge>
                  </div>
                  <p className="text-label-secondary text-footnote mt-0.5">by @Community Creator</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setSelectedPackId(null)}
                  title="Close Inspector"
                  aria-label="Close Inspector"
                  className="text-label-secondary hover:text-label"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* Sub-tabs Segmented Switcher */}
              <SegmentedControl
                size="sm"
                fullWidth
                asTabs
                aria-label="Pack inspector section"
                value={activeSubTab}
                onValueChange={setActiveSubTab}
                options={[
                  { value: "rules", label: "Rules" },
                  { value: "lexicon", label: "Lexicon" },
                  {
                    value: "reviews",
                    label: "Reviews",
                    badge: activePack.ratingCount,
                    badgeLabel: `${activePack.ratingCount} reviews`,
                  },
                ]}
              />

              {/* Tab 1: Rules & Phonology */}
              {activeSubTab === "rules" && (
                <div className="text-footnote space-y-3">
                  <p className="text-label-secondary leading-relaxed">
                    {activePack.description || "No extended documentation provided."}
                  </p>

                  <div className="bg-surface border-separator rounded-row space-y-2 border p-3 font-mono">
                    <div className="text-label text-eyebrow">Phonological Constraints</div>
                    <div className="text-caption grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-label-secondary">Family: </span>
                        <span className="text-label capitalize">{activePack.culturalFamily}</span>
                      </div>
                      <div>
                        <span className="text-label-secondary">Forks: </span>
                        <span className="text-label">{activePack.forkCount}</span>
                      </div>
                    </div>
                  </div>

                  <Button
                    type="button"
                    onClick={() => handleFork(activePack as LanguagePack)}
                    disabled={forkMutation.isPending}
                    className="bg-tint hover:bg-tint-hover rounded-row text-on-tint shadow-card h-9 w-full cursor-pointer font-semibold transition-[color,background-color,border-color,box-shadow,opacity,transform] active:scale-[0.97]"
                  >
                    <GitFork className="mr-2 h-4 w-4" />
                    <span>Fork Pack to My Studio</span>
                  </Button>
                </div>
              )}

              {/* Tab 2: Sample Lexicon */}
              {activeSubTab === "lexicon" && (
                <div className="text-footnote space-y-3">
                  <p className="text-label-secondary">
                    Seed dictionary vocabulary provided with this language pack:
                  </p>
                  <div className="bg-surface border-separator text-label rounded-row text-caption max-h-48 overflow-y-auto border p-3 font-mono leading-relaxed">
                    {(() => {
                      const packObj = activePack as { lexiconSeed?: unknown };
                      return Array.isArray(packObj.lexiconSeed) && packObj.lexiconSeed.length > 0
                        ? (packObj.lexiconSeed as string[]).join(", ")
                        : "Lexicon seed words bundled in package.";
                    })()}
                  </div>
                </div>
              )}

              {/* Tab 3: Reviews */}
              {activeSubTab === "reviews" && (
                <div className="text-footnote space-y-4">
                  {/* Rating input */}
                  <div className="bg-surface border-separator rounded-row space-y-2 border p-3">
                    <label className="text-label block font-semibold">
                      Leave a Community Rating
                    </label>
                    <div role="radiogroup" aria-label="Rating" className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Button
                          key={star}
                          variant="ghost"
                          size="icon-sm"
                          role="radio"
                          aria-checked={reviewRating === star}
                          aria-label={`${star} star${star === 1 ? "" : "s"}`}
                          onClick={() => setReviewRating(star)}
                        >
                          <Star
                            className={cn(
                              "h-4 w-4",
                              star <= reviewRating
                                ? "fill-yellow text-yellow"
                                : "text-label-quaternary"
                            )}
                          />
                        </Button>
                      ))}
                      <span className="text-yellow ml-2 font-mono font-semibold">
                        {reviewRating}.0 / 5.0
                      </span>
                    </div>

                    <Textarea
                      value={reviewComment}
                      onChange={(e) => setReviewComment(e.target.value)}
                      placeholder="Optional feedback about this language pack..."
                      rows={2}
                      className="text-footnote w-full resize-none"
                    />

                    <Button
                      type="button"
                      size="sm"
                      onClick={() => handleSubmitReview(activePack.id)}
                      disabled={rateMutation.isPending}
                      className="bg-fill-2 text-label hover:bg-fill-2 border-separator rounded-control h-8 w-full border font-semibold"
                    >
                      Submit Rating
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

export default LanguagePacksSection;
