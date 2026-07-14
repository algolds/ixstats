"use client";

// src/app/labs/onoma/components/sections/MarketplaceSection.tsx
// Onoma Lab — Conlang Marketplace Section

import { useState, useMemo } from "react";
import {
  ShoppingBag,
  Search,
  Star,
  GitFork,
  RefreshCw,
} from "lucide-react";
import { FacetMaterial } from "~/components/facet-ui";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";

const FAMILIES = [
  { value: "any", label: "All Families" },
  { value: "latin", label: "Latin / Roman" },
  { value: "germanic", label: "Germanic / Norse" },
  { value: "celtic", label: "Celtic / Gaelic" },
  { value: "slavic", label: "Slavic / Eastern European" },
  { value: "arabic", label: "Arabic / Near Eastern" },
  { value: "east-asian", label: "East Asian" },
  { value: "austronesian", label: "Austronesian" },
  { value: "persian", label: "Persian" },
  { value: "turkic", label: "Turkic" },
  { value: "african", label: "African" },
  { value: "indic", label: "Indic" },
  { value: "uralic", label: "Uralic" },
  { value: "constructed", label: "Constructed Conlang" },
];

export default function MarketplaceSection() {
  const notify = useNotify();
  const utils = api.useUtils();

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [familyFilter, setFamilyFilter] = useState("any");

  // Detail Modal / Panel state
  const [selectedPackId, setSelectedPackId] = useState<string | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<"details" | "lexicon" | "reviews">("details");

  // Review Form state
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");

  // Queries
  const { data: marketplaceData, isLoading, refetch } = api.onoma.marketplace.list.useQuery({
    searchQuery: searchQuery || undefined,
    culturalFamily: familyFilter !== "any" ? familyFilter : undefined,
  });

  const forkMutation = api.onoma.marketplace.fork.useMutation({
    onSuccess: () => {
      notify.success("Language pack successfully cloned/forked to your local studio!");
      void utils.onoma.marketplace.list.invalidate();
    },
    onError: (err) => {
      notify.error(`Failed to fork pack: ${err.message}`);
    },
  });

  const rateMutation = api.onoma.marketplace.rate.useMutation({
    onSuccess: () => {
      notify.success("Your rating has been submitted.");
      setReviewComment("");
      void utils.onoma.marketplace.list.invalidate();
    },
    onError: (err) => {
      notify.error(`Failed to submit review: ${err.message}`);
    },
  });

  const activePack = useMemo(() => {
    if (!selectedPackId || !marketplaceData) return null;
    return marketplaceData.packs.find((p) => p.id === selectedPackId) || null;
  }, [selectedPackId, marketplaceData]);

  const handleFork = (packId: string) => {
    forkMutation.mutate({ packId });
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-foreground text-xl font-bold tracking-tight">
            Conlang Marketplace
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Discover, review, and fork language packs created by the global conlang community.
          </p>
        </div>
      </div>

      {/* Main Grid: list on left/middle, details on right if selected */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* List & Filters Column */}
        <div className={activePack ? "lg:col-span-7 space-y-4" : "lg:col-span-12 space-y-4"}>
          {/* Filters Bar */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search language name or description..."
                className="w-full pl-9 pr-4 py-2 border rounded-lg bg-background/50 border-border/40 text-foreground text-sm focus:outline-none focus:border-amber-500/50"
              />
            </div>
            <select
              value={familyFilter}
              onChange={(e) => setFamilyFilter(e.target.value)}
              className="px-3 py-2 border rounded-lg bg-background/50 border-border/40 text-foreground text-sm focus:outline-none"
            >
              {FAMILIES.map((fam) => (
                <option key={fam.value} value={fam.value}>
                  {fam.label}
                </option>
              ))}
            </select>
            <button
              onClick={() => refetch()}
              className="p-2 border border-border/40 bg-secondary/20 hover:bg-secondary/40 text-foreground rounded-lg cursor-pointer active:scale-95"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>

          {/* Cards List */}
          {isLoading ? (
            <div className="flex h-64 items-center justify-center">
              <RefreshCw className="text-muted-foreground h-6 w-6 animate-spin" />
            </div>
          ) : marketplaceData?.packs.length === 0 ? (
            <FacetMaterial material="satin" className="border border-border/20 p-12 text-center">
              <ShoppingBag className="mx-auto h-12 w-12 text-muted-foreground opacity-30 mb-4" />
              <p className="text-sm text-muted-foreground">
                No matching language packs found. Try adjusting your filters.
              </p>
            </FacetMaterial>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {marketplaceData?.packs.map((pack) => {
                const isSelected = pack.id === selectedPackId;
                return (
                  <FacetMaterial
                    key={pack.id}
                    material="satin"
                    className={`border transition-all cursor-pointer p-4 space-y-3 relative overflow-hidden group ${
                      isSelected
                        ? "border-amber-500/40 bg-amber-500/5 shadow-[0_0_15px_rgba(245,158,11,0.05)]"
                        : "border-border/20 hover:border-amber-500/30"
                    }`}
                    onClick={() => setSelectedPackId(pack.id)}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-bold text-foreground group-hover:text-amber-500 transition-colors">
                          {pack.name}
                        </h4>
                        <span className="text-[10px] bg-secondary/50 text-muted-foreground px-2 py-0.5 rounded capitalize font-medium">
                          {pack.culturalFamily}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-amber-500 font-bold">
                        <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
                        <span>{pack.ratingAvg.toFixed(1)}</span>
                        <span className="text-muted-foreground font-normal">
                          ({pack.ratingCount})
                        </span>
                      </div>
                    </div>

                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {pack.description || "No description provided."}
                    </p>

                    <div className="flex flex-wrap gap-1">
                      {pack.tags.slice(0, 3).map((tag) => (
                        <span
                          key={tag}
                          className="text-[9px] bg-secondary/30 text-muted-foreground px-1.5 py-0.5 rounded font-mono"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>

                    <div className="flex items-center justify-between pt-2 text-[10px] text-muted-foreground border-t border-border/10">
                      <span>By @{pack.user?.forumUsername || "Creator"}</span>
                      <div className="flex items-center gap-2">
                        <span>Forks: {pack.forkCount}</span>
                        <span>Clones: {pack.cloneCount}</span>
                      </div>
                    </div>
                  </FacetMaterial>
                );
              })}
            </div>
          )}
        </div>

        {/* Details Panel Column */}
        {activePack && (
          <div className="lg:col-span-5 space-y-4">
            <FacetMaterial material="satin" className="border-amber-500/20 border p-4 space-y-4">
              <div className="flex justify-between items-start pb-2 border-b border-border/20">
                <div>
                  <h3 className="text-md font-extrabold text-foreground">{activePack.name}</h3>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Family: <span className="capitalize">{activePack.culturalFamily}</span>
                  </p>
                </div>
                <button
                  onClick={() => setSelectedPackId(null)}
                  className="text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  Close Detail
                </button>
              </div>

              {/* Sub tabs inside details */}
              <div className="grid grid-cols-3 gap-1 p-1 border rounded-lg bg-background/30 border-border/40 text-center text-xs">
                <button
                  onClick={() => setActiveSubTab("details")}
                  className={`py-1 rounded font-bold transition-all cursor-pointer ${
                    activeSubTab === "details" ? "bg-amber-500/10 text-amber-500" : "text-muted-foreground"
                  }`}
                >
                  Rules
                </button>
                <button
                  onClick={() => setActiveSubTab("lexicon")}
                  className={`py-1 rounded font-bold transition-all cursor-pointer ${
                    activeSubTab === "lexicon" ? "bg-amber-500/10 text-amber-500" : "text-muted-foreground"
                  }`}
                >
                  Dictionary
                </button>
                <button
                  onClick={() => setActiveSubTab("reviews")}
                  className={`py-1 rounded font-bold transition-all cursor-pointer ${
                    activeSubTab === "reviews" ? "bg-amber-500/10 text-amber-500" : "text-muted-foreground"
                  }`}
                >
                  Reviews
                </button>
              </div>

              {/* Details Tab Content */}
              {activeSubTab === "details" && (
                <div className="space-y-3">
                  <div>
                    <h5 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Description
                    </h5>
                    <p className="text-xs text-foreground mt-1 whitespace-pre-line">
                      {activePack.description || "No description provided."}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-border/10 space-y-2">
                    <h5 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Sound Inventory & Rules
                    </h5>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="p-2 rounded bg-secondary/10 border border-border/10">
                        <span className="block font-bold text-muted-foreground text-[10px]">Phonology</span>
                        <span className="text-foreground">Custom Accents Configured</span>
                      </div>
                      <div className="p-2 rounded bg-secondary/10 border border-border/10">
                        <span className="block font-bold text-muted-foreground text-[10px]">Orthography</span>
                        <span className="text-foreground">Standard Alphabet</span>
                      </div>
                    </div>
                  </div>

                  {/* Fork Action Button */}
                  <button
                    onClick={() => handleFork(activePack.id)}
                    disabled={forkMutation.isPending}
                    className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 text-white font-bold py-2 rounded-lg text-xs cursor-pointer active:scale-95 transition-all disabled:opacity-50 disabled:scale-100"
                  >
                    {forkMutation.isPending ? (
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <GitFork className="h-3.5 w-3.5" />
                    )}
                    Fork to Local Studio
                  </button>
                </div>
              )}

              {/* Lexicon Dictionary Tab Content */}
              {activeSubTab === "lexicon" && (
                <div className="space-y-3">
                  <h5 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Lexicon Specimen List
                  </h5>
                  <div className="max-h-60 overflow-y-auto border border-border/10 rounded divide-y divide-border/10 bg-background/20 scrollbar-thin">
                    {/* Render dictionary sample or dummy words if not present */}
                    {(activePack.versions?.[0]?.dictionaries as any[])?.length > 0 ? (
                      (activePack.versions[0].dictionaries as any[]).map((dict: any, idx: number) => (
                        <div key={idx} className="p-2 flex justify-between items-center text-xs">
                          <span className="font-semibold text-foreground">{dict.name}</span>
                          <span className="text-muted-foreground">({dict.values.length} words)</span>
                        </div>
                      ))
                    ) : (
                      <div className="p-4 text-center text-xs text-muted-foreground italic">
                        No vocabulary words saved in this release version yet.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Reviews Tab Content */}
              {activeSubTab === "reviews" && (
                <div className="space-y-4">
                  {/* Rating selector & Comment form */}
                  <div className="p-3 rounded-lg border border-border/20 bg-secondary/5 space-y-2">
                    <h5 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Rate Language Pack
                    </h5>
                    <div className="flex items-center gap-1.5">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setReviewRating(star)}
                          className="cursor-pointer transition-transform hover:scale-110"
                        >
                          <Star
                            className={`h-5 w-5 ${
                              star <= reviewRating
                                ? "fill-amber-500 text-amber-500"
                                : "text-muted-foreground"
                            }`}
                          />
                        </button>
                      ))}
                    </div>
                    <textarea
                      value={reviewComment}
                      onChange={(e) => setReviewComment(e.target.value)}
                      placeholder="Share your thoughts about this language..."
                      className="w-full px-2 py-1.5 border rounded bg-background/50 border-border/40 text-foreground text-xs h-16 focus:outline-none"
                    />
                    <button
                      onClick={() => handleSubmitReview(activePack.id)}
                      disabled={rateMutation.isPending}
                      className="w-full flex items-center justify-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white font-bold py-1.5 rounded text-xs cursor-pointer"
                    >
                      Submit Review
                    </button>
                  </div>

                  {/* Reviews timeline list */}
                  <div className="space-y-2 max-h-48 overflow-y-auto scrollbar-thin">
                    <div className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">
                      Recent Reviews
                    </div>
                    {/* Standard review feed placeholder */}
                    <div className="p-2 border border-border/10 rounded bg-background/10 text-xs text-muted-foreground italic text-center">
                      No customer reviews submitted yet. Be the first to rate!
                    </div>
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
