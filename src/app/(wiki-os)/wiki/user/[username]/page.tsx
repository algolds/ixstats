// src/app/(wiki-os)/wiki/user/[username]/page.tsx
// WikiOS User Profile — contributions, Loreward stats, streak calendar.

"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { withBasePath } from "~/lib/base-path";
import { api } from "~/trpc/react";
import { WikiOSLayout } from "~/components/wiki-os/shared/WikiOSLayout";
import { StreakCalendar } from "~/components/wiki-os/profile/StreakCalendar";
import {
  User,
  Trophy,
  Calendar,
  Page as FileText,
  Clock,
  Shield,
  GraphUp as TrendingUp,
  Medal as Award,
  FireFlame as Flame,
  OpenBook as BookOpen,
  SystemRestart as Loader2,
  Hashtag as Hash,
  ArrowUpRight,
  ArrowDownRight,
} from "iconoir-react";
import { cn } from "~/lib/utils";
import { formatMWTimeAgo } from "~/lib/wiki-os/adapters/mediawiki/timestamp";

export default function UserProfilePage() {
  const params = useParams<{ username: string }>();
  const username = decodeURIComponent(params.username);

  // Parallel data fetches
  const userInfo = api.wikios.getUserInfo.useQuery({ username });
  const contribs = api.wikios.getUserContribs.useQuery({ user: username, limit: 15 });
  const loreStats = api.lorewards.getUserStats.useQuery({ username });
  const awardHistory = api.lorewards.getUserAwardHistory.useQuery({ username, limit: 10 });

  const info = userInfo.data;
  const stats = loreStats.data?.stats;
  const rank = loreStats.data?.rank;
  const recentEntries = loreStats.data?.recentEntries ?? [];
  const awards = awardHistory.data?.entries ?? [];
  const edits = contribs.data?.contribs ?? [];

  const isLoading = userInfo.isLoading;

  return (
    <WikiOSLayout>
      <div className="wikios-special-page wikios-profile-page">
        {isLoading && (
          <div className="wikios-stashes-loading">
            <Loader2 className="h-6 w-6 animate-spin opacity-40" />
            <span>Loading profile...</span>
          </div>
        )}

        {!isLoading && info && !info.exists && (
          <div className="wikios-stashes-empty-state">
            <User className="h-12 w-12 opacity-20" />
            <h2>User not found</h2>
            <p>No MediaWiki account exists for &ldquo;{username}&rdquo;.</p>
          </div>
        )}

        {info?.exists && (
          <>
            {/* Unified IxnayID Profile Banner */}
            <div className="mb-4 flex items-center justify-between rounded-xl border border-blue-500/20 bg-blue-500/10 px-4 py-2.5 text-xs text-blue-300 backdrop-blur-md">
              <div className="flex items-center gap-2">
                <span className="font-bold text-white">IxnayID Account:</span>
                <span>Unified account profile available for @{username}</span>
              </div>
              <Link
                href={`/id/@${encodeURIComponent(username)}`}
                className="flex items-center gap-1 font-bold text-blue-400 hover:text-blue-300 hover:underline"
              >
                <span>View Full Profile</span>
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            {/* Profile Header */}
            <div className="wikios-profile-header">
              <div className="wikios-profile-avatar">
                <User className="h-8 w-8" />
              </div>
              <div className="wikios-profile-identity">
                <h1 className="wikios-profile-username">{username}</h1>
                <div className="wikios-profile-meta">
                  {info.registration && (
                    <span>
                      <Calendar className="h-3 w-3 inline mr-1" /> Joined{" "}
                      {new Date(info.registration).toLocaleDateString("en-US", {
                        month: "long",
                        year: "numeric",
                      })}
                    </span>
                  )}
                  <span>
                    <FileText className="h-3 w-3 inline mr-1" /> {info.editCount.toLocaleString()} edits
                  </span>
                  {rank && (
                    <span>
                      <Trophy className="h-3 w-3 inline mr-1" /> Rank #{rank}
                    </span>
                  )}
                </div>
                <div className="wikios-profile-groups">
                  {info.groups.map((g) => (
                    <span key={g} className="wikios-profile-group-badge">
                      <Shield className="h-2.5 w-2.5 inline mr-1" /> {g}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="wikios-profile-grid">
              {/* Left column */}
              <div className="wikios-profile-main">
                {/* Lorewards Summary */}
                {stats && (
                  <section className="wikios-profile-section">
                    <h2 className="wikios-profile-section-title">
                      <Trophy className="h-4 w-4" /> Lorewards
                    </h2>
                    <div className="wikios-profile-stats-grid">
                      <StatCard
                        label="Daily Wins"
                        value={stats.dailyWins}
                        icon={<Award className="h-4 w-4" />}
                        color="#fbbf24"
                      />
                      <StatCard
                        label="Runner-ups"
                        value={stats.dailyRunnerUps}
                        icon={<TrendingUp className="h-4 w-4" />}
                        color="#94a3b8"
                      />
                      <StatCard
                        label="Weekly Wins"
                        value={stats.weeklyWins}
                        icon={<Trophy className="h-4 w-4" />}
                        color="#60a5fa"
                      />
                      <StatCard
                        label="Monthly Wins"
                        value={stats.monthlyWins}
                        icon={<Trophy className="h-4 w-4" />}
                        color="#a78bfa"
                      />
                      <StatCard
                        label="Current Streak"
                        value={stats.currentStreak}
                        icon={<Flame className="h-4 w-4" />}
                        color={stats.currentStreak > 0 ? "#f97316" : "#64748b"}
                        suffix="days"
                      />
                      <StatCard
                        label="Best Streak"
                        value={stats.longestStreak}
                        icon={<Flame className="h-4 w-4" />}
                        color="#ef4444"
                        suffix="days"
                      />
                    </div>

                    {stats.totalScore > 0 && (
                      <div className="wikios-profile-total-row">
                        <span>
                          Total Score: <strong>{stats.totalScore.toLocaleString()}</strong>
                        </span>
                        <span>
                          Total Bytes: <strong>{stats.totalBytes.toLocaleString()}</strong>
                        </span>
                      </div>
                    )}
                  </section>
                )}

                {!stats && !loreStats.isLoading && (
                  <section className="wikios-profile-section">
                    <h2 className="wikios-profile-section-title">
                      <Trophy className="h-4 w-4" /> Lorewards
                    </h2>
                    <p className="wikios-profile-empty-text">No Loreward entries yet.</p>
                  </section>
                )}

                {/* Streak Calendar */}
                <section className="wikios-profile-section">
                  <h2 className="wikios-profile-section-title">
                    <Calendar className="h-4 w-4" /> Award Calendar
                  </h2>
                  <StreakCalendar username={username} />
                </section>

                {/* Award History */}
                {awards.length > 0 && (
                  <section className="wikios-profile-section">
                    <h2 className="wikios-profile-section-title">
                      <Award className="h-4 w-4" /> Award History
                    </h2>
                    <div className="wikios-profile-award-list">
                      {awards.map((a, i) => (
                        <div key={`${a.date}-${a.type}-${i}`} className="wikios-profile-award-row">
                          <span
                            className={cn(
                              "wikios-profile-award-badge",
                              `wikios-award-type-${a.type}`
                            )}
                          >
                            {a.type}
                          </span>
                          <span className="wikios-profile-award-date">{a.date}</span>
                          <span
                            className={cn(
                              "wikios-profile-award-role",
                              a.role === "winner" ? "wikios-award-winner" : "wikios-award-runner"
                            )}
                          >
                            {a.role === "winner" ? "Winner" : "Runner-up"}
                          </span>
                          {a.page && (
                            <Link
                              href={withBasePath(
                                `/wiki/${encodeURIComponent(a.page.replace(/ /g, "_"))}`
                              )}
                              className="wikios-profile-award-page"
                            >
                              {a.page}
                            </Link>
                          )}
                          {a.score && (
                            <span className="wikios-profile-award-score">
                              {a.score.toLocaleString()} pts
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </section>
                )}
              </div>

              {/* Right column */}
              <div className="wikios-profile-sidebar">
                {/* Recent Edits */}
                <section className="wikios-profile-section">
                  <h2 className="wikios-profile-section-title">
                    <BookOpen className="h-4 w-4" /> Recent Edits
                  </h2>
                  {edits.length === 0 && !contribs.isLoading && (
                    <p className="wikios-profile-empty-text">No recent edits.</p>
                  )}
                  <div className="wikios-profile-edits">
                    {edits.map((edit) => (
                      <div key={edit.revid} className="wikios-profile-edit-row">
                        <Link
                          href={withBasePath(
                            `/wiki/${encodeURIComponent(edit.title.replace(/ /g, "_"))}`
                          )}
                          className="wikios-profile-edit-title"
                        >
                          {edit.title}
                        </Link>
                        <div className="wikios-profile-edit-meta">
                          <span>
                            <Clock className="h-2.5 w-2.5 inline mr-1" /> {formatMWTimeAgo(edit.timestamp)}
                          </span>
                          <span
                            className={cn(
                              "wikios-profile-edit-size",
                              edit.size > 0
                                ? "wikios-diff-positive"
                                : edit.size < 0
                                  ? "wikios-diff-negative"
                                  : ""
                            )}
                          >
                            {edit.size > 0 ? (
                              <ArrowUpRight className="h-2.5 w-2.5 inline" />
                            ) : edit.size < 0 ? (
                              <ArrowDownRight className="h-2.5 w-2.5 inline" />
                            ) : null}
                            {edit.size > 0 ? "+" : ""}
                            {edit.size.toLocaleString()}
                          </span>
                          {edit.isNew && <span className="wikios-profile-edit-new">new</span>}
                          {edit.minor && <span className="wikios-profile-edit-minor">m</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                  <Link
                    href={withBasePath(`/wiki/contributions/${encodeURIComponent(username)}`)}
                    className="wikios-profile-view-all"
                  >
                    View all contributions
                  </Link>
                </section>

                {/* Recent Loreward Activity */}
                {recentEntries.length > 0 && (
                  <section className="wikios-profile-section">
                    <h2 className="wikios-profile-section-title">
                      <Hash className="h-4 w-4" /> Recent Activity
                    </h2>
                    <div className="wikios-profile-activity">
                      {recentEntries.slice(0, 7).map((e, i) => (
                        <div key={`${e.date}-${i}`} className="wikios-profile-activity-row">
                          <span
                            className={cn(
                              "wikios-profile-activity-dot",
                              e.role === "winner" ? "wikios-dot-gold" : "wikios-dot-silver"
                            )}
                          />
                          <span className="wikios-profile-activity-date">{e.date}</span>
                          <span className="wikios-profile-activity-role">{e.role}</span>
                        </div>
                      ))}
                    </div>
                  </section>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </WikiOSLayout>
  );
}

// ---------------------------------------------------------------------------
function StatCard({
  label,
  value,
  icon,
  color,
  suffix,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: string;
  suffix?: string;
}) {
  return (
    <div className="wikios-stat-card" style={{ "--stat-color": color } as React.CSSProperties}>
      <div className="wikios-stat-card-icon">{icon}</div>
      <div className="wikios-stat-card-value">
        {value}
        {suffix ? <span className="wikios-stat-card-suffix"> {suffix}</span> : null}
      </div>
      <div className="wikios-stat-card-label">{label}</div>
    </div>
  );
}
