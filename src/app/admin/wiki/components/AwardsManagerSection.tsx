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
import { UnifiedCountryFlag } from "~/components/shared/flags/UnifiedCountryFlag";
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
import { fieldStyles } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";

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
        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="text-title-3 flex items-center gap-2">
              <AwardIcon className="text-yellow h-5 w-5" />
              Issue Custom Award
            </CardTitle>
            <CardDescription>Assign article-level trophies or achievements</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateAward} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-label text-body font-medium">
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
                <label className="text-label text-body font-medium">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className={cn(
                    fieldStyles,
                    "rounded-control text-body h-(--control-height) w-full cursor-pointer px-3"
                  )}
                >
                  <option value="FEATURED">🏆 Featured Article</option>
                  <option value="COLLABORATION">👥 Collaboration Milestone</option>
                  <option value="PEER_REVIEW">✔️ Peer Reviewed</option>
                  <option value="SPECIAL">⭐ Special Recognition</option>
                  <option value="EDITOR_MILESTONE">✨ Editor Milestone</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-label text-body font-medium">Award Title / Badge</label>
                <Input
                  placeholder="e.g. Winner, Gold Star, 10k prose"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-label text-body font-medium">
                  Recipients (Comma-separated)
                </label>
                <Input
                  placeholder="e.g. User1, User2"
                  value={recipientText}
                  onChange={(e) => setRecipientText(e.target.value)}
                />
              </div>

              {/* Medal Icon Builder Section */}
              <div className="border-separator space-y-3 border-t pt-3">
                <span className="text-eyebrow text-yellow">Medal Icon Builder</span>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-label text-caption">Shape</label>
                    <select
                      value={iconShape}
                      onChange={(e) => setIconShape(e.target.value)}
                      className={cn(
                        fieldStyles,
                        "rounded-control-sm text-footnote h-(--control-height-sm) w-full cursor-pointer px-2.5"
                      )}
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
                    <label className="text-label text-caption">Color Type</label>
                    <select
                      value={iconColor}
                      onChange={(e) => setIconColor(e.target.value)}
                      className={cn(
                        fieldStyles,
                        "rounded-control-sm text-footnote h-(--control-height-sm) w-full cursor-pointer px-2.5"
                      )}
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
                    <label className="text-label text-caption">Custom Color (HEX)</label>
                    <div className="flex gap-2">
                      <Input
                        type="text"
                        placeholder="#ffd700"
                        value={customHex}
                        onChange={(e) => setCustomHex(e.target.value)}
                        className="rounded-control-sm md:text-footnote h-(--control-height-sm) font-mono"
                      />
                      <Input
                        type="color"
                        value={
                          customHex.startsWith("#") && customHex.length === 7
                            ? customHex
                            : "#ffd700"
                        }
                        onChange={(e) => setCustomHex(e.target.value)}
                        className="rounded-control-sm md:text-footnote h-(--control-height-sm) w-10 cursor-pointer"
                      />
                    </div>
                  </div>
                )}

                {/* Ambient Glass Medal Preview */}
                <div className="border-separator bg-fill-4 rounded-row flex flex-col items-center justify-center border p-3.5">
                  <span className="text-label-secondary text-eyebrow mb-2 select-none">
                    Live Medal Preview
                  </span>
                  <div className="border-separator bg-surface duration-fast relative flex h-14 w-14 items-center justify-center rounded-full border transition-[color,background-color,border-color,box-shadow,opacity,transform]">
                    <div
                      className="absolute inset-0 rounded-full opacity-20 transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-500"
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
                            "duration-fast relative z-10 h-7.5 w-7.5 transition-[color,background-color,border-color,box-shadow,opacity,transform]",
                            colorClass
                          )}
                          style={customStyle}
                        />
                      );
                    })()}
                  </div>
                  <span className="text-label text-caption mt-2 max-w-[15rem] truncate">
                    {name || "Award Title"}
                  </span>
                  <span className="text-label-secondary text-eyebrow mt-0.5">
                    {category.replace("_", " ")}
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-label text-body font-medium">Citation / Description</label>
                <Textarea
                  placeholder="Enter citation details..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full"
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
        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="text-title-3 flex items-center gap-2">
              <Sparkles className="text-pink h-5 w-5" />
              Automated Milestones
            </CardTitle>
            <CardDescription>Scan page histories and auto-assign milestones</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-label-secondary text-footnote space-y-2">
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
                <label className="text-label text-body font-medium">
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
                className="w-full gap-2"
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
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-title-3 flex items-center gap-2">
                  <History className="text-yellow h-5 w-5" />
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
                className="w-8"
              >
                <RefreshCw className={cn("h-4 w-4", isLoadingWinners && "animate-spin")} />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {isLoadingWinners ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="rounded-control h-12 w-full" />
                ))}
              </div>
            ) : !recentWinners || recentWinners.length === 0 ? (
              <div className="text-label-secondary text-body py-8 text-center italic">
                No recent winners recorded in the database.
              </div>
            ) : (
              <div className="border-separator rounded-control max-h-[16rem] overflow-y-auto border">
                <table className="text-body w-full tabular-nums">
                  <thead className="bg-fill-3 sticky top-0">
                    <tr className="border-separator border-b">
                      <th className="text-label-secondary text-caption px-4 py-2 text-left">
                        Date
                      </th>
                      <th className="text-label-secondary text-caption px-4 py-2 text-left">
                        Type
                      </th>
                      <th className="text-label-secondary text-caption px-4 py-2 text-left">
                        Winner
                      </th>
                      <th className="text-label-secondary text-caption px-4 py-2 text-left">
                        Article Page
                      </th>
                      <th className="text-label-secondary text-caption px-4 py-2 text-right">
                        Metrics
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-separator divide-y">
                    {recentWinners.map((winner, idx) => {
                      const typeColors: Record<string, string> = {
                        daily: "bg-yellow/10 text-yellow border-yellow/25",
                        weekly: "bg-blue/10 text-blue border-blue/25",
                        monthly: "bg-purple/10 text-purple border-purple/25",
                      };

                      return (
                        <tr key={idx} className="hover:bg-fill-4 transition-colors">
                          <td className="text-caption px-4 py-2 tabular-nums">{winner.date}</td>
                          <td className="px-4 py-2">
                            <span
                              className={cn(
                                "rounded-control-sm text-eyebrow border px-1.5 py-0.5",
                                typeColors[winner.type] || "bg-fill-3 text-label-secondary"
                              )}
                            >
                              {winner.type}
                            </span>
                          </td>
                          <td className="px-4 py-2">
                            <div className="text-caption flex items-center gap-1.5">
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
                          <td className="text-footnote px-4 py-2">
                            {winner.winnerPage ? (
                              <a
                                href={`/wiki/${winner.winnerPage}`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-yellow flex items-center gap-1 font-semibold hover:underline"
                              >
                                {winner.winnerPage}
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            ) : (
                              <span className="text-label-secondary text-footnote italic">
                                No page
                              </span>
                            )}
                          </td>
                          <td className="text-footnote px-4 py-2 text-right font-mono">
                            <span className="text-label font-semibold">
                              {winner.winnerScore ? `${winner.winnerScore} pts` : "—"}
                            </span>
                            {winner.winnerBytes ? (
                              <span className="text-label-secondary text-footnote ml-1.5">
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
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-title-3">Issued Awards</CardTitle>
                <CardDescription>Chronological list of all manual wiki rewards</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={awardCategory}
                  onChange={(e) => setAwardCategory(e.target.value)}
                  className={cn(
                    fieldStyles,
                    "rounded-control-sm text-footnote h-(--control-height-sm) cursor-pointer px-2.5"
                  )}
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
              <Search className="text-label-secondary absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
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
                  <Skeleton key={i} className="rounded-control h-16 w-full" />
                ))}
              </div>
            ) : !awards || awards.length === 0 ? (
              <div className="text-label-secondary text-body py-8 text-center">
                No awards match your filter criteria.
              </div>
            ) : (
              <div className="border-separator rounded-control max-h-[30rem] overflow-y-auto border">
                <table className="text-body w-full tabular-nums">
                  <thead className="bg-fill-3 sticky top-0">
                    <tr className="border-separator border-b">
                      <th className="text-label-secondary px-4 py-2.5 text-left font-medium">
                        Article
                      </th>
                      <th className="text-label-secondary px-4 py-2.5 text-left font-medium">
                        Award & Badge
                      </th>
                      <th className="text-label-secondary hidden px-4 py-2.5 text-left font-medium sm:table-cell">
                        Recipients
                      </th>
                      <th className="text-label-secondary hidden px-4 py-2.5 text-left font-medium md:table-cell">
                        Awarded At
                      </th>
                      <th className="w-12 px-4 py-2.5" />
                    </tr>
                  </thead>
                  <tbody className="divide-separator divide-y">
                    {awards.map((award) => {
                      const recipients = Array.isArray(award.recipientUsers)
                        ? (award.recipientUsers as string[])
                        : typeof award.recipientUsers === "string"
                          ? (JSON.parse(award.recipientUsers) as string[])
                          : [];

                      return (
                        <tr key={award.id} className="hover:bg-fill-4 transition-colors">
                          <td className="text-label px-4 py-2.5 font-medium">{award.pageTitle}</td>
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-1.5">
                              {renderAwardBadgeIcon(award)}
                              <span className="font-medium">{award.name}</span>
                            </div>
                            {award.description && (
                              <p className="text-label-secondary text-footnote mt-0.5 line-clamp-1">
                                {award.description}
                              </p>
                            )}
                          </td>
                          <td className="text-footnote hidden px-4 py-2.5 sm:table-cell">
                            {recipients.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {recipients.map((user) => (
                                  <Badge key={user} variant="secondary" className="px-1.5 py-0">
                                    {user}
                                  </Badge>
                                ))}
                              </div>
                            ) : (
                              <span className="text-label-secondary opacity-50">—</span>
                            )}
                          </td>
                          <td className="text-label-secondary text-footnote hidden px-4 py-2.5 md:table-cell">
                            {new Date(award.awardedAt).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleDeleteAward(award.id)}
                              className="text-destructive w-8"
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
