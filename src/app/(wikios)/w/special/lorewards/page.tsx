// src/app/(wikios)/w/special/lorewards/page.tsx
// Lorewards — Order of the Lore leaderboard, recent winners, and FAQ.

"use client";

import { useState } from "react";
import Link from "next/link";
import { withBasePath } from "~/lib/base-path";
import { api } from "~/trpc/react";
import { WikiOSLayout } from "~/components/wikios/shared/WikiOSLayout";
import {
  Trophy, Award, Flame, Clock, Loader2, ChevronDown, ChevronRight,
  BookOpen, Users, Zap, Calendar, Medal, HelpCircle, Scale,
  Highlighter, GitBranch, FileText, Star,
} from "lucide-react";
import { cn } from "~/lib/utils";
import { SimpleFlag } from "~/components/SimpleFlag";

type Period = "alltime" | "daily" | "weekly" | "monthly";
type Tab = "leaderboard" | "recent" | "faq";

export default function LorewardsPage() {
  const [period, setPeriod] = useState<Period>("alltime");
  const [tab, setTab] = useState<Tab>("leaderboard");

  const leaderboard = api.lorewards.getLeaderboard.useQuery({ period, limit: 25 });
  const recent = api.lorewards.getRecentWinners.useQuery({ limit: 20 });

  const leaders = leaderboard.data ?? [];
  const winners = recent.data ?? [];

  return (
    <WikiOSLayout>
      <div className="wikios-special-page wikios-lw-page">
        {/* Hero Header */}
        <div className="wikios-lw-hero">
          <div className="wikios-lw-hero-icon">
            <LorewardsHeroIcon />
          </div>
          <div className="wikios-lw-hero-text">
            <h1 className="wikios-lw-hero-title">Order of the Lore</h1>
            <p className="wikios-lw-hero-subtitle">
              Recognizing outstanding contributions to worldbuilding since 2017
            </p>
          </div>
          <div className="wikios-lw-hero-stats">
            <HeroStat icon={<Users size={14} />} value={leaders.length} label="Members" />
            <HeroStat icon={<Calendar size={14} />} value="2017" label="Established" />
            <HeroStat icon={<Medal size={14} />} value="Daily" label="Awards" />
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="wikios-lw-tabs">
          <button onClick={() => setTab("leaderboard")} className={cn("wikios-lw-main-tab", tab === "leaderboard" && "wikios-lw-main-tab-active")}>
            <Trophy size={14} /> Leaderboard
          </button>
          <button onClick={() => setTab("recent")} className={cn("wikios-lw-main-tab", tab === "recent" && "wikios-lw-main-tab-active")}>
            <Clock size={14} /> Recent Winners
          </button>
          <button onClick={() => setTab("faq")} className={cn("wikios-lw-main-tab", tab === "faq" && "wikios-lw-main-tab-active")}>
            <HelpCircle size={14} /> How It Works
          </button>
        </div>

        {/* Leaderboard Tab */}
        {tab === "leaderboard" && (
          <div className="wikios-lw-section">
            <div className="wikios-lw-period-bar">
              {(["alltime", "daily", "weekly", "monthly"] as Period[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={cn("wikios-lorewards-tab", period === p && "wikios-lorewards-tab-active")}
                >
                  {p === "alltime" ? "All Time" : p.charAt(0).toUpperCase() + p.slice(1)}
                </button>
              ))}
            </div>

            {/* Top 3 Podium */}
            {leaders.length >= 3 && (
              <div className="wikios-lw-podium">
                <PodiumCard user={leaders[1]!} rank={2} maxScore={leaders[0]!.totalScore} />
                <PodiumCard user={leaders[0]!} rank={1} maxScore={leaders[0]!.totalScore} />
                <PodiumCard user={leaders[2]!} rank={3} maxScore={leaders[0]!.totalScore} />
              </div>
            )}

            {leaderboard.isLoading && (
              <div className="wikios-stashes-loading-sm"><Loader2 size={16} className="animate-spin opacity-40" /></div>
            )}

            {/* Full Table (ranks 4+) */}
            {leaders.length > 3 && (
              <div className="wikios-lw-table">
                <div className="wikios-lw-table-head">
                  <span className="wikios-lw-th-rank">Rank</span>
                  <span className="wikios-lw-th-user">Member</span>
                  <span className="wikios-lw-th-num">Daily</span>
                  <span className="wikios-lw-th-num">Weekly</span>
                  <span className="wikios-lw-th-num">Monthly</span>
                  <span className="wikios-lw-th-num">Medal Score</span>
                  <span className="wikios-lw-th-num">Streak</span>
                </div>
                {leaders.slice(3).map((user) => (
                  <Link
                    key={user.username}
                    href={withBasePath(`/w/special/user/${encodeURIComponent(user.username)}`)}
                    className="wikios-lw-table-row"
                  >
                    <span className="wikios-lw-td-rank">{user.rank}</span>
                    <span className="wikios-lw-td-user">
                      <SimpleFlag countryName={user.username} size="sm" className="wikios-lw-table-flag" showPlaceholder={false} />
                      {user.username}
                    </span>
                    <span className="wikios-lw-td-num">{user.dailyWins}</span>
                    <span className="wikios-lw-td-num">{user.weeklyWins}</span>
                    <span className="wikios-lw-td-num">{user.monthlyWins}</span>
                    <span className="wikios-lw-td-num wikios-lw-td-score">{user.totalScore.toLocaleString()}</span>
                    <span className="wikios-lw-td-num">
                      {user.currentStreak > 0 && <Flame size={11} className="inline text-orange-400 mr-0.5" />}
                      {user.currentStreak > 0 ? user.currentStreak : "—"}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Recent Winners Tab */}
        {tab === "recent" && (
          <div className="wikios-lw-section">
            {winners.length === 0 && (
              <div className="wikios-stashes-empty-stash"><Trophy size={32} className="opacity-15" /><p>No recent winners.</p></div>
            )}
            <div className="wikios-lw-winners-grid">
              {winners.map((w, i) => (
                <div key={`${w.date}-${w.type}-${i}`} className="wikios-lw-winner-card">
                  <div className="wikios-lw-winner-header">
                    <span className={cn("wikios-profile-award-badge", `wikios-award-type-${w.type}`)}>{w.type}</span>
                    <span className="wikios-lw-winner-date">{formatEntryDate(w)}</span>
                  </div>
                  {w.winnerUser && (
                    <Link href={withBasePath(`/w/special/user/${encodeURIComponent(w.winnerUser)}`)} className="wikios-lw-winner-user">
                      <SimpleFlag countryName={w.winnerUser} size="sm" showPlaceholder={false} />
                      {w.winnerUser}
                    </Link>
                  )}
                  {w.winnerPage && (
                    <Link href={withBasePath(`/w/${encodeURIComponent(w.winnerPage.replace(/ /g, "_"))}`)} className="wikios-lw-winner-page">
                      <BookOpen size={12} />
                      {w.winnerPage}
                    </Link>
                  )}
                  {w.runnerUpUser && (
                    <div className="wikios-lw-winner-runner">
                      <span className="wikios-lw-runner-label">Runner-up:</span>
                      <Link href={withBasePath(`/w/special/user/${encodeURIComponent(w.runnerUpUser)}`)} className="wikios-lw-runner-name">
                        {w.runnerUpUser}
                      </Link>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* FAQ / How It Works Tab */}
        {tab === "faq" && (
          <div className="wikios-lw-section wikios-lw-faq">
            <div className="wikios-lw-faq-intro">
              <p>
                The <strong>Order of the Lore</strong> (Lorewards) is IxWiki&apos;s award system recognizing
                outstanding contributions to the collaborative worldbuilding project. Established in 2017,
                it tracks daily, weekly, and monthly achievements through a combination of automated
                scoring and community panel review.
              </p>
            </div>

            <FaqSection icon={<Zap size={16} />} title="How are daily winners chosen?">
              <p>
                Every night at <strong>11:30 PM Eastern</strong>, the Lorewards bot analyzes all mainspace
                edits made that day. It scores each contributor&apos;s work based on multiple quality signals:
              </p>
              <div className="wikios-lw-faq-signals">
                <SignalCard icon={<FileText />} name="Byte Count" desc="The foundation — how much content was added (positive changes only)" />
                <SignalCard icon={<Highlighter />} name="Prose Quality" desc="Real writing vs template/infobox filler. Prose-heavy edits score higher than parameter lists" />
                <SignalCard icon={<GitBranch />} name="Collaborative Lore" desc="Editing articles outside your own country earns a bonus — building the shared world together" />
                <SignalCard icon={<BookOpen />} name="Edit Depth" desc="Sustained work on a single article over time is rewarded. Deep worldbuilding > drive-by edits" />
                <SignalCard icon={<Star />} name="Article Importance" desc="Edits to hub articles with many inbound links have slightly more impact" />
              </div>
              <p>
                The bot posts its top picks to the <strong>#lorewards</strong> Discord channel with Approve/Reject
                buttons. A rotating panel of community members reviews the pick. If no action is taken within
                one hour, the result is auto-approved.
              </p>
            </FaqSection>

            <FaqSection icon={<Scale size={16} />} title="How is the score calculated?">
              <p>The scoring formula combines a base byte count with quality multipliers:</p>
              <div className="wikios-lw-faq-formula">
                <code>
                  finalScore = bytesAdded × proseRatio × collaborativeBonus × depthBonus × importanceBonus
                </code>
              </div>
              <div className="wikios-lw-faq-penalties">
                <h4>Penalties</h4>
                <ul>
                  <li><strong>Infobox/template filler</strong> — Edits that are &gt;80% template parameters (like <code>| population = 50000</code>) are disqualified</li>
                  <li><strong>List articles</strong> — Pages titled &ldquo;List of...&rdquo; receive a 70% penalty (0.3× multiplier)</li>
                  <li><strong>Minor-only edits</strong> — If all edits are minor and the largest is under 1,000 bytes, an 80% penalty applies</li>
                </ul>
                <h4>Requirements</h4>
                <ul>
                  <li>The daily winner must have at least one single edit of <strong>1,000+ bytes</strong></li>
                  <li>List-only articles cannot win the daily award (runner-up only)</li>
                  <li>Bot accounts are excluded from consideration</li>
                </ul>
              </div>
            </FaqSection>

            <FaqSection icon={<Calendar size={16} />} title="How do weekly and monthly awards work?">
              <p><strong>Weekly winners</strong> are determined every Sunday based on the week&apos;s daily results:</p>
              <ul>
                <li>Daily win = <strong>3 points</strong></li>
                <li>Daily runner-up = <strong>1 point</strong></li>
                <li>Active day (any placement) = <strong>1 point</strong></li>
              </ul>
              <p><strong>Monthly winners</strong> aggregate daily and weekly performance:</p>
              <ul>
                <li>Weekly win = <strong>5 points</strong></li>
                <li>Daily win = <strong>2 points</strong></li>
                <li>Daily runner-up = <strong>1 point</strong></li>
              </ul>
              <p>
                <strong>Annual winners</strong> are selected by community consensus considering overall contribution
                volume, quality, and consistency throughout the year.
              </p>
            </FaqSection>

            <FaqSection icon={<Medal size={16} />} title="What is the Medal Score?">
              <p>
                The <strong>Medal Score</strong> is the canonical ranking metric maintained on the
                {" "}<a href="https://ixwiki.com/wiki/IxWiki:OOL" target="_blank" rel="noopener" className="wikios-lw-faq-link">IxWiki:OOL</a> page.
                It&apos;s based on medals earned:
              </p>
              <div className="wikios-lw-faq-medals">
                <MedalRow emoji="🥉" name="Bronze" points={1} how="Daily win (1 medal per win)" />
                <MedalRow emoji="🥈" name="Silver" points={10} how="= 10 Bronze medals combined" />
                <MedalRow emoji="🥇" name="Gold" points={50} how="= 5 Silver medals combined" />
                <MedalRow emoji="💎" name="Burg Cross" points={250} how="= 5 Gold medals combined (highest honor)" />
              </div>
              <p>
                Bonus: Any single edit over <strong>50,000 bytes</strong> earns an additional Bronze medal regardless
                of daily winner status.
              </p>
            </FaqSection>

            <FaqSection icon={<Users size={16} />} title="Who are the panelists?">
              <p>
                Loreward determinations are made by <strong>weekly rotating panels</strong> of three community members.
                The panel foreman nominates candidates, and the other two members vote. Panelists exercise subjective
                judgment — they may prefer a smaller, high-quality contribution over a larger but routine edit.
              </p>
              <p>
                The automated bot generates candidates to assist the panel, but panelists retain full authority
                to approve, reject, or re-run the bot&apos;s picks.
              </p>
            </FaqSection>

            <FaqSection icon={<HelpCircle size={16} />} title="What qualifies as an eligible edit?">
              <p>Per the OOL rules, preference is given to:</p>
              <ul>
                <li>Extraordinary contribution to <strong>collaborative global lore</strong></li>
                <li>Lore written <strong>for someone else</strong> or for shared world topics</li>
                <li>Overall <strong>quality of written lore</strong></li>
                <li>Extremely well-written <strong>novel topics</strong></li>
                <li>Substantive content (not just infoboxes, lists, or minor formatting)</li>
              </ul>
              <p>
                Determinations use <strong>Eastern Time (EST/EDT)</strong>. When a date shows
                &ldquo;None awarded,&rdquo; it means the panel reviewed that day and found no eligible entries.
                Skipped dates indicate no panel was convened.
              </p>
            </FaqSection>
          </div>
        )}
      </div>
    </WikiOSLayout>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function HeroStat({ icon, value, label }: { icon: React.ReactNode; value: string | number; label: string }) {
  return (
    <div className="wikios-lw-hero-stat">
      {icon}
      <span className="wikios-lw-hero-stat-value">{value}</span>
      <span className="wikios-lw-hero-stat-label">{label}</span>
    </div>
  );
}

function PodiumCard({ user, rank }: {
  user: { username: string; totalScore: number; dailyWins: number; weeklyWins: number; monthlyWins: number; currentStreak: number; longestStreak: number };
  rank: number;
  maxScore?: number;
}) {
  const colors = { 1: "#fbbf24", 2: "#94a3b8", 3: "#cd7f32" };
  const color = colors[rank as keyof typeof colors]!;
  const totalAwards = user.dailyWins + user.weeklyWins + user.monthlyWins;

  return (
    <Link href={withBasePath(`/w/special/user/${encodeURIComponent(user.username)}`)} className={cn("wikios-lw-podium-card", rank === 1 && "wikios-lw-podium-first")}>
      {/* Background sparkline */}
      <AwardSparkline username={user.username} color={color} />

      <div className="wikios-lw-podium-content">
        <div className="wikios-lw-podium-rank" style={{ background: color }}>
          {rank === 1 ? <Trophy size={16} /> : <Award size={14} />}
          <span>#{rank}</span>
        </div>
        <SimpleFlag countryName={user.username} size="md" className="wikios-lw-podium-flag" showPlaceholder={false} />
        <div className="wikios-lw-podium-name">{user.username}</div>
        <div className="wikios-lw-podium-score" style={{ color }}>{totalAwards} <span className="wikios-lw-podium-score-label">awards</span></div>
        <div className="wikios-lw-podium-meta">
          {user.dailyWins} daily · {user.weeklyWins} weekly · {user.monthlyWins} monthly
        </div>
        <div className="wikios-lw-podium-bottom">
          {user.currentStreak > 0 && <span className="wikios-lw-podium-streak"><Flame size={10} />{user.currentStreak} streak</span>}
          <span>Score: {user.totalScore.toLocaleString()}</span>
        </div>
      </div>
    </Link>
  );
}

/** SVG sparkline showing cumulative award growth over time */
function AwardSparkline({ username, color }: { username: string; color: string }) {
  const { data } = api.lorewards.getAwardFrequency.useQuery(
    { username },
    { staleTime: 300000 }
  );

  if (!data || data.length < 2) return null;

  const values = data.map((d) => d.cumulative);
  const max = Math.max(...values);
  if (max === 0) return null;

  const w = 200;
  const h = 80;
  const padding = 2;

  const points = values.map((v, i) => {
    const x = padding + (i / (values.length - 1)) * (w - padding * 2);
    const y = h - padding - (v / max) * (h - padding * 2);
    return `${x},${y}`;
  });

  const linePath = `M${points.join(" L")}`;
  const areaPath = `${linePath} L${w - padding},${h} L${padding},${h} Z`;

  return (
    <svg
      className="wikios-lw-sparkline"
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id={`spark-${username}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.2" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#spark-${username})`} />
      <path d={linePath} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" opacity="0.5" />
    </svg>
  );
}

function FaqSection({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={cn("wikios-lw-faq-section", open && "wikios-lw-faq-section-open")}>
      <button onClick={() => setOpen(!open)} className="wikios-lw-faq-trigger">
        <span className="wikios-lw-faq-icon">{icon}</span>
        <span className="wikios-lw-faq-title">{title}</span>
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      </button>
      {open && <div className="wikios-lw-faq-content">{children}</div>}
    </div>
  );
}

function SignalCard({ icon, name, desc }: { icon: React.ReactElement; name: string; desc: string }) {
  return (
    <div className="wikios-lw-signal-card">
      <span className="wikios-lw-signal-icon">{icon}</span>
      <div>
        <strong>{name}</strong>
        <span>{desc}</span>
      </div>
    </div>
  );
}

function MedalRow({ emoji, name, points, how }: { emoji: string; name: string; points: number; how: string }) {
  return (
    <div className="wikios-lw-medal-row">
      <span className="wikios-lw-medal-emoji">{emoji}</span>
      <span className="wikios-lw-medal-name">{name}</span>
      <span className="wikios-lw-medal-pts">{points} pts</span>
      <span className="wikios-lw-medal-how">{how}</span>
    </div>
  );
}

function formatDate(dateStr: string): string {
  // Handle ISO week format (e.g. "2026-W13")
  if (/^\d{4}-W\d+$/.test(dateStr)) {
    return dateStr; // Will be overridden by formatEntryDate for range display
  }
  // Handle YYYY-MM format
  if (/^\d{4}-\d{2}$/.test(dateStr)) {
    const [year, month] = dateStr.split("-");
    const d = new Date(Number(year), Number(month) - 1);
    return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  }
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatEntryDate(entry: { date: string; type: string; dateStart?: string | null; dateEnd?: string | null }): string {
  // Weekly/monthly entries with date range
  if (entry.dateStart && entry.dateEnd) {
    const start = formatShortDate(entry.dateStart);
    const end = formatShortDate(entry.dateEnd);
    // If same year, don't repeat it
    const startYear = new Date(entry.dateStart).getFullYear();
    const endYear = new Date(entry.dateEnd).getFullYear();
    if (startYear === endYear) {
      return `${start} – ${end}, ${endYear}`;
    }
    return `${formatDate(entry.dateStart)} – ${formatDate(entry.dateEnd)}`;
  }

  // Monthly entries without explicit range — derive from YYYY-MM key
  if (entry.type === "monthly" && /^\d{4}-\d{2}$/.test(entry.date)) {
    return formatDate(entry.date); // Returns "March 2026" etc.
  }

  // Weekly entries without range — show week identifier nicely
  if (entry.type === "weekly" && /^\d{4}-W(\d+)$/.test(entry.date)) {
    const match = entry.date.match(/^(\d{4})-W(\d+)$/);
    if (match) return `Week ${match[2]}, ${match[1]}`;
  }

  // Daily entries — just the date
  return formatDate(entry.date);
}

// ---------------------------------------------------------------------------
// Animated hero icon — quill writes, pages flutter, star glows on hover
// ---------------------------------------------------------------------------
function LorewardsHeroIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="64"
      height="64"
      viewBox="0 0 24 24"
      fill="none"
      className="wikios-lw-animated-icon"
    >
      <defs>
        <linearGradient id="lwh-gold" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#d97706" />
        </linearGradient>
      </defs>

      {/* Shield frame */}
      <path
        className="lwh-shield"
        d="M12 2L4 6v6c0 5.25 3.4 10.2 8 11.5C16.6 22.2 20 17.25 20 12V6l-8-4z"
        fill="none"
        stroke="url(#lwh-gold)"
        strokeWidth="1"
        strokeLinejoin="round"
        opacity="0.5"
      />

      {/* Star glow layer (behind) */}
      <circle className="lwh-star-glow" cx="12" cy="6" r="1.5" fill="#fbbf24" opacity="0" />

      {/* Star */}
      <circle className="lwh-star" cx="12" cy="6" r="1.3" fill="#fbbf24" opacity="0.7" />

      {/* Quill nib */}
      <g className="lwh-nib">
        <path
          d="M12 7.5c-2.8 2.8-2.8 5.5-1.3 8.5l1.3 1 1.3-1c1.5-3 1.5-5.7-1.3-8.5z"
          fill="url(#lwh-gold)"
          opacity="0.85"
        />
        <line x1="12" y1="9" x2="12" y2="15" stroke="#1d4e89" strokeWidth="0.3" opacity="0.35" />
      </g>

      {/* Book — left page */}
      <path
        className="lwh-page-l"
        d="M6.5 18.5c1.5-1 3.5-1 5.5 0v2c-2-1-4-1-5.5 0z"
        fill="url(#lwh-gold)"
        opacity="0.5"
      />
      {/* Book — right page */}
      <path
        className="lwh-page-r"
        d="M17.5 18.5c-1.5-1-3.5-1-5.5 0v2c2-1 4-1 5.5 0z"
        fill="url(#lwh-gold)"
        opacity="0.5"
      />
      {/* Book spine */}
      <line x1="12" y1="18" x2="12" y2="21" stroke="#1d4e89" strokeWidth="0.4" opacity="0.25" />
    </svg>
  );
}
