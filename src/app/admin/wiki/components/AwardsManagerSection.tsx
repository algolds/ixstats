"use client";
// src/app/admin/wiki/components/AwardsManagerSection.tsx
// Lorewards & custom wiki awards manager.

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Input } from "~/components/ui/input";
import { Skeleton } from "~/components/ui/skeleton";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { UnifiedCountryFlag } from "~/components/ui/UnifiedCountryFlag";
import {
  Trophy as AwardIcon,
  Sparks as Sparkles,
  ClockRotateRight as History,
  Refresh as RefreshCw,
  OpenNewWindow as ExternalLink,
  Search,
  Trash as Trash2,
  SystemRestart as Loader2,
} from "iconoir-react";
import { cn } from "~/lib/utils";
import { getIconComponent, getColorClass, getColorHex } from "./types";

export function AwardsManagerSection() {
  const notify = useNotify();

  // Creation form states
  const [pageTitle, setPageTitle] = useState("");
  const [category, setCategory] = useState("FEATURED");
  const [name, setName] = useState("");
  const [recipientText, setRecipientText] = useState("");
  const [description, setDescription] = useState("");

  const [awardSearch, setAwardSearch] = useState("");
  const [awardCategory, setAwardCategory] = useState<string>("all");
  const [milestonePages, setMilestonePages] = useState("");

  // Medal Icon Builder States
  const [iconShape, setIconShape] = useState("trophy");
  const [iconColor, setIconColor] = useState("amber");
  const [customHex, setCustomHex] = useState("#ffd700");

  const {
    data: awards,
    refetch: refetchAwards,
    isLoading: isLoadingAwards,
  } = api.admin.getWikiArticleAwards.useQuery({
    category: awardCategory === "all" ? undefined : awardCategory,
    search: awardSearch || undefined,
  });

  // Fetch recent daily/weekly/monthly winners
  const {
    data: recentWinners,
    isLoading: isLoadingWinners,
    refetch: refetchRecentWinners,
  } = api.lorewards.getRecentWinners.useQuery({
    limit: 10,
  });

  const createAwardMutation = api.admin.createWikiArticleAwardBatch.useMutation({
    onSuccess: () => {
      notify.success("Awards Issued", "Wiki award(s) added successfully");
      refetchAwards();
      setPageTitle("");
      setName("");
      setRecipientText("");
      setDescription("");
      setIconShape("trophy");
      setIconColor("amber");
      setCustomHex("#ffd700");
    },
    onError: (err) => notify.error("Creation Error", err.message),
  });

  const evaluateMilestonesMutation = api.admin.evaluateWikiMilestones.useMutation({
    onSuccess: (data) => {
      notify.success(
        "Scan Complete",
        `Scan complete. Generated ${data.createdCount} new milestone awards.`
      );
      refetchAwards();
      setMilestonePages("");
    },
    onError: (err) => notify.error("Milestone Scan Error", err.message),
  });

  const deleteAwardMutation = api.admin.deleteWikiArticleAward.useMutation({
    onSuccess: () => {
      notify.success("Award Removed", "Wiki award deleted");
      refetchAwards();
    },
    onError: (err) => notify.error("Deletion Error", err.message),
  });

  const handleCreateAward = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pageTitle.trim() || !name.trim()) return;

    const titles = pageTitle
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const recipients = recipientText
      ? recipientText
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : [];

    createAwardMutation.mutate({
      pageTitles: titles,
      category,
      name,
      description: description || undefined,
      recipientUsers: recipients,
      metadata: JSON.stringify({
        icon: iconShape,
        color: iconColor === "custom" ? customHex : iconColor,
      }),
    });
  };

  const handleScanMilestones = (e: React.FormEvent) => {
    e.preventDefault();
    const titles = milestonePages
      ? milestonePages
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : undefined;

    evaluateMilestonesMutation.mutate({ pageTitles: titles });
  };

  const handleDeleteAward = (id: string) => {
    if (confirm("Are you sure you want to delete this award?")) {
      deleteAwardMutation.mutate({ id });
    }
  };

  const renderAwardBadgeIcon = (award: any) => {
    let iconName = "sparkles";
    let colorVal = "amber";
    let customStyle: React.CSSProperties = {};
    let isCustomHex = false;

    if (award.metadata) {
      try {
        const meta = JSON.parse(award.metadata);
        if (meta.icon) iconName = meta.icon;
        if (meta.color) {
          colorVal = meta.color;
          if (colorVal.startsWith("#")) {
            isCustomHex = true;
            customStyle = { color: colorVal };
          }
        }
      } catch {
        // ignore
      }
    } else {
      if (award.category === "FEATURED") {
        iconName = "trophy";
        colorVal = "amber";
      } else if (award.category === "COLLABORATION") {
        iconName = "users";
        colorVal = "cyan";
      } else if (award.category === "PEER_REVIEW") {
        iconName = "check";
        colorVal = "green";
      } else if (award.category === "SPECIAL") {
        iconName = "star";
        colorVal = "purple";
      } else {
        iconName = "sparkles";
        colorVal = "pink";
      }
    }

    const IconComp = getIconComponent(iconName);
    const colorClass = getColorClass(colorVal);

    return (
      <IconComp
        className={cn("h-4.5 w-4.5 shrink-0", !isCustomHex && colorClass)}
        style={customStyle}
      />
    );
  };

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="flex flex-col gap-6 lg:col-span-1">
        {/* Creation form */}
        <Card className="border-border/50 bg-card/80 h-fit backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <AwardIcon className="h-5 w-5 text-amber-500" />
              Issue Custom Award
            </CardTitle>
            <CardDescription>Assign article-level trophies or achievements</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateAward} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-foreground text-sm font-medium">
                  Page Title(s) (comma-separated)
                </label>
                <Input
                  placeholder="e.g. Main Page, Caphiria..."
                  value={pageTitle}
                  onChange={(e) => setPageTitle(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-foreground text-sm font-medium">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="bg-background border-border/50 text-foreground w-full rounded-lg border px-3 py-2 text-sm focus:ring-1 focus:ring-blue-500"
                >
                  <option value="FEATURED">🏆 Featured Article</option>
                  <option value="COLLABORATION">👥 Collaboration Milestone</option>
                  <option value="PEER_REVIEW">✔️ Peer Reviewed</option>
                  <option value="SPECIAL">⭐ Special Recognition</option>
                  <option value="EDITOR_MILESTONE">✨ Editor Milestone</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-foreground text-sm font-medium">Award Title / Badge</label>
                <Input
                  placeholder="e.g. Winner, Gold Star, 10k prose"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-foreground text-sm font-medium">
                  Recipients (Comma-separated)
                </label>
                <Input
                  placeholder="e.g. User1, User2"
                  value={recipientText}
                  onChange={(e) => setRecipientText(e.target.value)}
                />
              </div>

              {/* Medal Icon Builder Section */}
              <div className="border-border/20 space-y-3 border-t pt-3">
                <span className="text-[10px] font-black tracking-wider text-amber-500 uppercase">
                  Medal Icon Builder
                </span>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-foreground text-xs font-medium">Shape</label>
                    <select
                      value={iconShape}
                      onChange={(e) => setIconShape(e.target.value)}
                      className="bg-background border-border/50 text-foreground w-full rounded-lg border px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none"
                    >
                      <option value="trophy">🏆 Trophy</option>
                      <option value="medal">🏅 Medal</option>
                      <option value="star">⭐ Star</option>
                      <option value="crown">👑 Crown</option>
                      <option value="shield">🛡️ Shield</option>
                      <option value="award">🎖️ Award</option>
                      <option value="users">👥 Users</option>
                      <option value="check">✔️ Check</option>
                      <option value="sparkles">✨ Sparkles</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-foreground text-xs font-medium">Color Type</label>
                    <select
                      value={iconColor}
                      onChange={(e) => setIconColor(e.target.value)}
                      className="bg-background border-border/50 text-foreground w-full rounded-lg border px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none"
                    >
                      <option value="amber">Amber (Gold)</option>
                      <option value="slate">Slate (Silver)</option>
                      <option value="cyan">Cyan</option>
                      <option value="green">Green</option>
                      <option value="purple">Purple</option>
                      <option value="pink">Pink</option>
                      <option value="red">Red</option>
                      <option value="custom">Custom HEX</option>
                    </select>
                  </div>
                </div>

                {iconColor === "custom" && (
                  <div className="space-y-1.5">
                    <label className="text-foreground text-xs font-medium">
                      Custom Color (HEX)
                    </label>
                    <div className="flex gap-2">
                      <Input
                        type="text"
                        placeholder="#ffd700"
                        value={customHex}
                        onChange={(e) => setCustomHex(e.target.value)}
                        className="h-8 font-mono text-xs"
                      />
                      <Input
                        type="color"
                        value={
                          customHex.startsWith("#") && customHex.length === 7
                            ? customHex
                            : "#ffd700"
                        }
                        onChange={(e) => setCustomHex(e.target.value)}
                        className="h-8 w-10 cursor-pointer overflow-hidden rounded-md border-0 bg-transparent p-0"
                      />
                    </div>
                  </div>
                )}

                {/* Ambient Glass Medal Preview */}
                <div className="border-border/40 bg-muted/20 flex flex-col items-center justify-center rounded-xl border p-3.5 backdrop-blur-md">
                  <span className="text-muted-foreground/60 mb-2 text-[10px] font-bold uppercase select-none">
                    Live Medal Preview
                  </span>
                  <div className="border-border/50 bg-card/65 relative flex h-14 w-14 items-center justify-center rounded-full border shadow-inner transition-all duration-300">
                    <div
                      className="absolute inset-0 rounded-full opacity-25 blur-md transition-all duration-500"
                      style={{
                        backgroundColor:
                          iconColor === "custom" ? customHex : getColorHex(iconColor),
                      }}
                    />
                    {(() => {
                      const IconComp = getIconComponent(iconShape);
                      const isCustom = iconColor === "custom";
                      const customStyle = isCustom ? { color: customHex } : undefined;
                      const colorClass = !isCustom ? getColorClass(iconColor) : "";
                      return (
                        <IconComp
                          className={cn(
                            "relative z-10 h-7.5 w-7.5 drop-shadow-[0_2px_8px_rgba(0,0,0,0.15)] transition-all duration-300",
                            colorClass
                          )}
                          style={customStyle}
                        />
                      );
                    })()}
                  </div>
                  <span className="text-foreground mt-2 max-w-[15rem] truncate text-xs font-black">
                    {name || "Award Title"}
                  </span>
                  <span className="text-muted-foreground/70 mt-0.5 text-[9px] font-bold tracking-wider uppercase">
                    {category.replace("_", " ")}
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-foreground text-sm font-medium">
                  Citation / Description
                </label>
                <textarea
                  placeholder="Enter citation details..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="bg-background border-border/50 text-foreground w-full rounded-lg border px-3 py-2 text-sm focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <Button
                type="submit"
                disabled={createAwardMutation.isPending}
                className="mt-2 w-full gap-2"
              >
                {createAwardMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Create & Issue Award
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Automated Milestones Panel */}
        <Card className="border-border/50 bg-card/80 h-fit backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Sparkles className="h-5 w-5 text-pink-500" />
              Automated Milestones
            </CardTitle>
            <CardDescription>Scan page histories and auto-assign milestones</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-muted-foreground space-y-2 text-xs">
              <p>Runs database analysis on article histories to award:</p>
              <ul className="list-disc space-y-1 pl-4">
                <li>
                  <strong>Prose Length:</strong> 10k, 50k, 100k milestone badges
                </li>
                <li>
                  <strong>Collaboration:</strong> 3+ unique contributors
                </li>
                <li>
                  <strong>Edit Depth:</strong> 50+ total revisions
                </li>
              </ul>
            </div>

            <form onSubmit={handleScanMilestones} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-foreground text-sm font-medium">
                  Specific Pages to Scan (Optional)
                </label>
                <Input
                  placeholder="e.g. Caphiria, Main Page (comma-separated)"
                  value={milestonePages}
                  onChange={(e) => setMilestonePages(e.target.value)}
                />
              </div>

              <Button
                type="submit"
                disabled={evaluateMilestonesMutation.isPending}
                className="w-full gap-2 border-0 bg-gradient-to-r from-pink-500 to-purple-600 text-white hover:from-pink-600 hover:to-purple-700"
              >
                {evaluateMilestonesMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                Scan & Generate Milestones
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-6 lg:col-span-2">
        {/* Recent Winners Log */}
        <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <History className="h-5 w-5 text-amber-500" />
                  Recent Winners Log
                </CardTitle>
                <CardDescription>
                  Chronological feed of automatically calculated daily, weekly, and monthly loreward
                  winners
                </CardDescription>
              </div>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => refetchRecentWinners()}
                disabled={isLoadingWinners}
                className="text-muted-foreground h-8 w-8"
              >
                <RefreshCw className={cn("h-4 w-4", isLoadingWinners && "animate-spin")} />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {isLoadingWinners ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full rounded-lg" />
                ))}
              </div>
            ) : !recentWinners || recentWinners.length === 0 ? (
              <div className="text-muted-foreground py-8 text-center text-sm italic">
                No recent winners recorded in the database.
              </div>
            ) : (
              <div className="border-border/30 max-h-[16rem] overflow-y-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/80 sticky top-0 backdrop-blur-sm">
                    <tr className="border-border/30 border-b">
                      <th className="text-muted-foreground px-4 py-2 text-left text-xs font-medium">
                        Date
                      </th>
                      <th className="text-muted-foreground px-4 py-2 text-left text-xs font-medium">
                        Type
                      </th>
                      <th className="text-muted-foreground px-4 py-2 text-left text-xs font-medium">
                        Winner
                      </th>
                      <th className="text-muted-foreground px-4 py-2 text-left text-xs font-medium">
                        Article Page
                      </th>
                      <th className="text-muted-foreground px-4 py-2 text-right text-xs font-medium">
                        Metrics
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-border/20 divide-y">
                    {recentWinners.map((winner, idx) => {
                      const typeColors: Record<string, string> = {
                        daily:
                          "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25",
                        weekly:
                          "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/25",
                        monthly:
                          "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/25",
                      };

                      return (
                        <tr key={idx} className="hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-2 font-mono text-xs font-semibold">
                            {winner.date}
                          </td>
                          <td className="px-4 py-2">
                            <span
                              className={cn(
                                "rounded border px-1.5 py-0.5 text-[9px] font-black tracking-wider uppercase",
                                typeColors[winner.type] || "bg-muted text-muted-foreground"
                              )}
                            >
                              {winner.type}
                            </span>
                          </td>
                          <td className="px-4 py-2">
                            <div className="flex items-center gap-1.5 text-xs font-bold">
                              {winner.winnerUser && (
                                <>
                                  <UnifiedCountryFlag
                                    countryName={winner.winnerUser}
                                    size="xs"
                                    showTooltip={false}
                                  />
                                  {winner.winnerUser}
                                </>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-2 text-xs">
                            {winner.winnerPage ? (
                              <a
                                href={`/wiki/${winner.winnerPage}`}
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center gap-1 font-semibold text-amber-500 hover:underline"
                              >
                                {winner.winnerPage}
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            ) : (
                              <span className="text-muted-foreground text-[11px] italic">
                                No page
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-2 text-right font-mono text-xs">
                            <span className="text-foreground font-semibold">
                              {winner.winnerScore ? `${winner.winnerScore} pts` : "—"}
                            </span>
                            {winner.winnerBytes ? (
                              <span className="text-muted-foreground ml-1.5 text-[10px]">
                                (+{(winner.winnerBytes / 1000).toFixed(1)}k bytes)
                              </span>
                            ) : null}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Active Awards List */}
        <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-lg">Issued Awards</CardTitle>
                <CardDescription>Chronological list of all manual wiki rewards</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={awardCategory}
                  onChange={(e) => setAwardCategory(e.target.value)}
                  className="bg-background border-border/50 text-foreground rounded-lg border px-2.5 py-1 text-xs"
                >
                  <option value="all">All Categories</option>
                  <option value="FEATURED">Featured</option>
                  <option value="COLLABORATION">Collaboration</option>
                  <option value="PEER_REVIEW">Peer Review</option>
                  <option value="SPECIAL">Special</option>
                  <option value="EDITOR_MILESTONE">Milestones</option>
                </select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
              <Input
                placeholder="Search awards by page title..."
                value={awardSearch}
                onChange={(e) => setAwardSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            {isLoadingAwards ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full rounded-lg" />
                ))}
              </div>
            ) : !awards || awards.length === 0 ? (
              <div className="text-muted-foreground py-8 text-center text-sm">
                No awards match your filter criteria.
              </div>
            ) : (
              <div className="border-border/30 max-h-[30rem] overflow-y-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/80 sticky top-0 backdrop-blur-sm">
                    <tr className="border-border/30 border-b">
                      <th className="text-muted-foreground px-4 py-2.5 text-left font-medium">
                        Article
                      </th>
                      <th className="text-muted-foreground px-4 py-2.5 text-left font-medium">
                        Award & Badge
                      </th>
                      <th className="text-muted-foreground hidden px-4 py-2.5 text-left font-medium sm:table-cell">
                        Recipients
                      </th>
                      <th className="text-muted-foreground hidden px-4 py-2.5 text-left font-medium md:table-cell">
                        Awarded At
                      </th>
                      <th className="w-12 px-4 py-2.5" />
                    </tr>
                  </thead>
                  <tbody className="divide-border/20 divide-y">
                    {awards.map((award) => {
                      const recipients = Array.isArray(award.recipientUsers)
                        ? (award.recipientUsers as string[])
                        : typeof award.recipientUsers === "string"
                          ? (JSON.parse(award.recipientUsers) as string[])
                          : [];

                      return (
                        <tr key={award.id} className="hover:bg-muted/30 transition-colors">
                          <td className="text-foreground px-4 py-2.5 font-medium">
                            {award.pageTitle}
                          </td>
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-1.5">
                              {renderAwardBadgeIcon(award)}
                              <span className="font-medium">{award.name}</span>
                            </div>
                            {award.description && (
                              <p className="text-muted-foreground mt-0.5 line-clamp-1 text-xs">
                                {award.description}
                              </p>
                            )}
                          </td>
                          <td className="hidden px-4 py-2.5 text-xs sm:table-cell">
                            {recipients.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {recipients.map((user) => (
                                  <Badge key={user} variant="secondary" className="px-1.5 py-0">
                                    {user}
                                  </Badge>
                                ))}
                              </div>
                            ) : (
                              <span className="text-muted-foreground opacity-50">—</span>
                            )}
                          </td>
                          <td className="text-muted-foreground hidden px-4 py-2.5 text-xs md:table-cell">
                            {new Date(award.awardedAt).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleDeleteAward(award.id)}
                              className="h-8 w-8 text-red-500 hover:bg-red-500/10"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
