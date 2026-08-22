"use client";

import { useState, useEffect } from "react";
import { WikiOSLayout } from "~/components/wiki-os/shared/WikiOSLayout";
import { api } from "~/trpc/react";
import {
  Clock,
  FileText,
  FilePlus,
  FolderOpen,
  Bookmark,
  Hash,
  AlertTriangle,
  Layers,
  Info,
  Sliders,
  CheckCircle2,
  Search,
  ArrowUpDown,
  Activity,
  BookOpen,
} from "lucide-react";
import { formatMWTimeAgo } from "~/lib/wiki-os/adapters/mediawiki/timestamp";
import { useFacetDepth } from "~/components/ui/facet-container";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  LineChart,
  Line,
} from "recharts";
import { WikiChart, useWikiChartColors } from "~/components/ui/wiki-chart";

type SandboxTab = "playground" | "recent-changes" | "stashes" | "wiki-examples" | "analytics";

interface TemplateRow {
  name: string;
  count: number;
  category: string;
  active: boolean;
}

const mockTemplates: TemplateRow[] = [
  { name: "Template:CountryData", count: 820, category: "Geography", active: true },
  { name: "Template:LeaderProfile", count: 340, category: "Politics", active: true },
  { name: "Template:EconomicMetrics", count: 560, category: "Economy", active: false },
  { name: "Template:MilitaryStrength", count: 210, category: "Military", active: true },
  { name: "Template:DiplomaticRelations", count: 430, category: "Diplomacy", active: true },
  { name: "Template:LoreCardInfo", count: 180, category: "Stashes", active: false },
  { name: "Template:IntelReport", count: 90, category: "Intelligence", active: true },
];

export default function WikiSandboxPage() {
  const [activeTab, setActiveTab] = useState<SandboxTab>("playground");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <WikiOSLayout title="Kapwa Sandbox">
      <div className="flex flex-col gap-6 p-4">
        {/* Experimental Notice styled as Kapwa Alert inside glass card */}
        <div className="wikios-card flex items-start gap-3 border-amber-500/30 bg-amber-500/5 p-4 text-amber-700 dark:text-amber-500">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <h4 className="text-xs font-bold">Kapwa Trial Sandbox (Experimental)</h4>
            <p className="mt-1 text-[10px] leading-relaxed opacity-80">
              This sandbox is a scoped visual integration test comparing Kapwa components and
              layouts in the WikiOS environment. Kapwa styling variables have been mapped to Facet
              glass and paper design system variables.
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap gap-2 border-b border-[var(--wikios-border)] pb-3">
          {(
            [
              "playground",
              "recent-changes",
              "stashes",
              "wiki-examples",
              "analytics",
            ] as SandboxTab[]
          ).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`rounded px-3 py-1.5 text-xs font-semibold transition-colors ${
                activeTab === tab
                  ? "bg-[var(--wikios-accent)] text-white shadow-[0_0_10px_rgba(59,130,246,0.3)]"
                  : "text-[var(--wikios-text-muted)] hover:bg-black/5 hover:text-[var(--wikios-text)] dark:hover:bg-white/5"
              }`}
            >
              {tab.replace("-", " ").toUpperCase()}
            </button>
          ))}
        </div>

        {/* Tab Renderers */}
        {activeTab === "playground" && <PlaygroundTab />}

        {activeTab === "recent-changes" && <RecentChangesSimulator />}

        {activeTab === "stashes" && <StashesSimulator />}

        {activeTab === "wiki-examples" && <WikiExamplesTab />}

        {activeTab === "analytics" && mounted && <AnalyticsTab />}
      </div>
    </WikiOSLayout>
  );
}

/* ===========================================================================
   PLAYGROUND TAB COMPONENT
   =========================================================================== */
function PlaygroundTab() {
  const [opacity, setOpacity] = useState(45);
  const [blur, setBlur] = useState(16);
  const [glare, setGlare] = useState(8);
  const [theme, setTheme] = useState<"light" | "dark">("dark");

  const [formData, setFormData] = useState({
    username: "",
    category: "Geography",
    notify: true,
    progress: 40,
  });

  const [filterText, setFilterText] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "count">("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 4;

  useEffect(() => {
    const observer = new MutationObserver(() => {
      const currentTheme =
        document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
      setTheme(currentTheme);
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    setTheme(document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark");
    return () => observer.disconnect();
  }, []);

  const cardBgStyle =
    theme === "light"
      ? `rgba(255, 255, 255, ${opacity / 100})`
      : `rgba(30, 32, 40, ${opacity / 100})`;

  const handleSort = (field: "name" | "count") => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder("asc");
    }
  };

  const filteredTemplates = mockTemplates.filter(
    (t) =>
      t.name.toLowerCase().includes(filterText.toLowerCase()) ||
      t.category.toLowerCase().includes(filterText.toLowerCase())
  );

  const sortedTemplates = [...filteredTemplates].sort((a, b) => {
    let comp = 0;
    if (sortBy === "name") {
      comp = a.name.localeCompare(b.name);
    } else {
      comp = a.count - b.count;
    }
    return sortOrder === "asc" ? comp : -comp;
  });

  const paginatedTemplates = sortedTemplates.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const totalPages = Math.ceil(sortedTemplates.length / pageSize) || 1;

  return (
    <div className="flex flex-col gap-6">
      <div className="wikios-card flex flex-col gap-4 p-5">
        <div className="mb-1 flex items-center gap-2">
          <Layers className="h-4 w-4 text-[var(--wikios-accent)]" />
          <h3 className="text-sm font-bold text-[var(--wikios-text)]">Component Playground</h3>
        </div>
        <p className="text-xs leading-relaxed text-[var(--wikios-text-muted)]">
          These elements are rendered using Kapwa classes, styled as volumetric glass structures,
          and inherit colors from the active WikiOS theme.
        </p>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* Form Showcase */}
          <div className="flex flex-col gap-4 rounded border border-[var(--wikios-border)] bg-black/[0.01] p-4 dark:bg-white/[0.01]">
            <h4 className="text-xs font-bold text-[var(--wikios-text-muted)]">Form Showcase</h4>
            <div className="flex flex-col gap-3">
              <div>
                <label className="mb-1 block text-[10px] font-bold text-[var(--wikios-text-muted)] uppercase">
                  User Account Name
                </label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  placeholder="Wiki username..."
                  className="w-full rounded border border-[var(--wikios-border)] bg-black/10 px-3 py-1.5 text-xs text-[var(--wikios-text)] outline-none focus:border-blue-500/50 dark:bg-white/5"
                />
              </div>

              <div>
                <label className="mb-1 block text-[10px] font-bold text-[var(--wikios-text-muted)] uppercase">
                  Scope Category
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full rounded border border-[var(--wikios-border)] bg-white px-3 py-1.5 text-xs text-[var(--wikios-text)] outline-none focus:border-blue-500/50 dark:bg-zinc-900"
                >
                  <option>Geography</option>
                  <option>Politics</option>
                  <option>Economy</option>
                  <option>Military</option>
                </select>
              </div>

              <div className="flex items-center justify-between py-1">
                <span className="text-[11px] font-medium text-[var(--wikios-text)]">
                  Enable system notices
                </span>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, notify: !formData.notify })}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out outline-none ${
                    formData.notify ? "bg-[var(--wikios-accent)]" : "bg-zinc-700"
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      formData.notify ? "translate-x-4" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between text-[10px] font-bold text-[var(--wikios-text-muted)] uppercase">
                  <span>Simulation Capacity</span>
                  <span>{formData.progress}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
                  <div
                    className="h-full bg-[var(--wikios-accent)] shadow-[0_0_8px_rgba(59,130,246,0.5)] transition-all duration-300"
                    style={{ width: `${formData.progress}%` }}
                  />
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={formData.progress}
                  onChange={(e) =>
                    setFormData({ ...formData, progress: parseInt(e.target.value, 10) })
                  }
                  className="mt-2 w-full cursor-pointer accent-[var(--wikios-accent)]"
                />
              </div>
            </div>
          </div>

          {/* Interactive Card Sliders */}
          <div className="flex flex-col gap-4 rounded border border-[var(--wikios-border)] bg-black/[0.01] p-4 dark:bg-white/[0.01]">
            <h4 className="text-xs font-bold text-[var(--wikios-text-muted)]">
              Interactive Card Sliders
            </h4>
            <div className="flex flex-col gap-3">
              <div>
                <div className="mb-1 flex justify-between text-[10px] font-bold text-[var(--wikios-text-muted)] uppercase">
                  <span>Glass Opacity</span>
                  <span>{opacity}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={opacity}
                  onChange={(e) => setOpacity(parseInt(e.target.value, 10))}
                  className="w-full cursor-pointer accent-[var(--wikios-accent)]"
                />
              </div>

              <div>
                <div className="mb-1 flex justify-between text-[10px] font-bold text-[var(--wikios-text-muted)] uppercase">
                  <span>Backdrop Blur</span>
                  <span>{blur}px</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="32"
                  value={blur}
                  onChange={(e) => setBlur(parseInt(e.target.value, 10))}
                  className="w-full cursor-pointer accent-[var(--wikios-accent)]"
                />
              </div>

              <div>
                <div className="mb-1 flex justify-between text-[10px] font-bold text-[var(--wikios-text-muted)] uppercase">
                  <span>Chamfer Glare Opacity</span>
                  <span>{glare}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={glare}
                  onChange={(e) => setGlare(parseInt(e.target.value, 10))}
                  className="w-full cursor-pointer accent-[var(--wikios-accent)]"
                />
              </div>

              {/* Adjustable Glass Card Result */}
              <div
                className="wikios-card-adjustable flex items-center justify-center border-[var(--wikios-border)] p-5 text-center text-xs"
                style={
                  {
                    "--sandbox-card-bg": cardBgStyle,
                    "--sandbox-card-blur": `${blur}px`,
                    "--sandbox-card-glare": `${glare / 100}`,
                  } as React.CSSProperties
                }
              >
                <div className="flex flex-col items-center gap-1.5">
                  <Sliders className="h-5 w-5 text-[var(--wikios-accent)]" />
                  <span className="text-[10px] font-extrabold tracking-wider text-[var(--wikios-text)] uppercase">
                    Adjustable Surface Card
                  </span>
                  <span className="text-[10px] text-[var(--wikios-text-muted)]">
                    Updating local CSS variables dynamically
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Data Table Showcase */}
        <div className="mt-2 flex flex-col gap-3 rounded border border-[var(--wikios-border)] bg-black/[0.01] p-4 dark:bg-white/[0.01]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-xs font-bold text-[var(--wikios-text-muted)]">
              Wiki Templates Registry
            </h4>
            <div className="relative w-full max-w-xs sm:w-64">
              <Search className="absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-[var(--wikios-text-dim)]" />
              <input
                type="text"
                placeholder="Search templates..."
                value={filterText}
                onChange={(e) => {
                  setFilterText(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full rounded border border-[var(--wikios-border)] bg-black/10 py-1 pr-3 pl-8 text-[11px] text-[var(--wikios-text)] outline-none focus:border-blue-500/50 dark:bg-white/5"
              />
            </div>
          </div>

          <div className="overflow-x-auto rounded border border-[var(--wikios-border)] bg-black/5 dark:bg-white/[0.01]">
            <table className="w-full border-collapse text-[11px] text-[var(--wikios-text)]">
              <thead>
                <tr className="border-b border-[var(--wikios-border)] bg-black/10 text-left font-bold text-[var(--wikios-text-muted)] uppercase dark:bg-white/[0.02]">
                  <th
                    onClick={() => handleSort("name")}
                    className="cursor-pointer p-2.5 transition-colors hover:text-[var(--wikios-text)]"
                  >
                    <div className="flex items-center gap-1.5">
                      Template Name <ArrowUpDown className="h-3 w-3" />
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort("count")}
                    className="cursor-pointer p-2.5 transition-colors hover:text-[var(--wikios-text)]"
                  >
                    <div className="flex items-center gap-1.5">
                      Usage Count <ArrowUpDown className="h-3 w-3" />
                    </div>
                  </th>
                  <th className="p-2.5">Category</th>
                  <th className="p-2.5">Status</th>
                </tr>
              </thead>
              <tbody>
                {paginatedTemplates.length > 0 ? (
                  paginatedTemplates.map((row, idx) => (
                    <tr
                      key={idx}
                      className="border-b border-[var(--wikios-border)] transition-colors hover:bg-black/5 dark:hover:bg-white/[0.02]"
                    >
                      <td className="p-2.5 font-semibold text-blue-400">{row.name}</td>
                      <td className="p-2.5 font-mono">{row.count.toLocaleString()}</td>
                      <td className="p-2.5 text-[var(--wikios-text-muted)]">{row.category}</td>
                      <td className="p-2.5">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${
                            row.active
                              ? "border border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                              : "border border-red-500/20 bg-red-500/10 text-red-400"
                          }`}
                        >
                          {row.active ? "Active" : "Deprecating"}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-[var(--wikios-text-dim)]">
                      No matching templates found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="mt-1 flex items-center justify-between text-[11px] text-[var(--wikios-text-muted)]">
            <span>
              Showing {(currentPage - 1) * pageSize + 1} to{" "}
              {Math.min(currentPage * pageSize, sortedTemplates.length)} of {sortedTemplates.length}{" "}
              templates
            </span>
            <div className="flex gap-1">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(currentPage - 1)}
                className="rounded border border-[var(--wikios-border)] px-2.5 py-1 transition-colors hover:bg-black/5 disabled:pointer-events-none disabled:opacity-30 dark:hover:bg-white/5"
              >
                Prev
              </button>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(currentPage + 1)}
                className="rounded border border-[var(--wikios-border)] px-2.5 py-1 transition-colors hover:bg-black/5 disabled:pointer-events-none disabled:opacity-30 dark:hover:bg-white/5"
              >
                Next
              </button>
            </div>
          </div>
        </div>

        {/* Visual Alerts Banners */}
        <div className="mt-2 flex flex-col gap-3 rounded border border-[var(--wikios-border)] bg-black/[0.01] p-4 dark:bg-white/[0.01]">
          <h4 className="text-xs font-bold text-[var(--wikios-text-muted)]">
            Volumetric Alert Banners
          </h4>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex items-start gap-2.5 rounded border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <h5 className="font-bold">Sync Completed</h5>
                <p className="mt-0.5 text-[10px] leading-relaxed opacity-85">
                  Prisma schema changes successfully synced with index metadata collections.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2.5 rounded border border-red-500/20 bg-red-500/5 p-3 text-xs text-red-600 dark:text-red-400">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <h5 className="font-bold">Read-Only Guard</h5>
                <p className="mt-0.5 text-[10px] leading-relaxed opacity-85">
                  Database is locked due to emergency production database migration checks.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ===========================================================================
   RECENT CHANGES TAB COMPONENT
   =========================================================================== */
function RecentChangesSimulator() {
  const { data: changes, isLoading } = api.wikios.getRecentChanges.useQuery(
    { limit: 15 },
    { staleTime: 30_000 }
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-5 w-5 animate-spin rounded-full border-b-2 border-[var(--wikios-accent)]" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="wikios-card flex flex-col gap-2 p-5">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-[var(--wikios-accent)]" />
            <h3 className="text-sm font-bold text-[var(--wikios-text)]">
              Recent Changes Simulator
            </h3>
          </div>
          <span className="text-[10px] text-[var(--wikios-text-dim)]">
            Live tRPC query timeline
          </span>
        </div>

        <div className="flex flex-col gap-3">
          {changes?.map((change, idx) => {
            const diff = (change.newLen ?? 0) - (change.oldLen ?? 0);
            const diffSign = diff > 0 ? "+" : "";
            const diffClass =
              diff > 0
                ? "text-emerald-500"
                : diff < 0
                  ? "text-red-500"
                  : "text-muted-foreground/60";

            return (
              <div
                key={idx}
                className="flex items-start justify-between rounded border border-[var(--wikios-border)] bg-black/[0.01] p-3 transition-colors hover:bg-black/[0.03] dark:bg-white/[0.01] dark:hover:bg-white/[0.03]"
              >
                <div className="flex min-w-0 flex-1 items-start gap-2.5">
                  {change.type === "new" ? (
                    <FilePlus className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                  ) : (
                    <FileText className="mt-0.5 h-4 w-4 shrink-0 text-blue-400" />
                  )}
                  <div className="min-w-0 flex-1">
                    <span className="block cursor-pointer truncate text-xs font-semibold text-[var(--wikios-text)] hover:underline">
                      {change.title}
                    </span>
                    <div className="mt-1 flex items-center gap-1.5 text-[10px] text-[var(--wikios-text-muted)]">
                      <span className="font-bold">{change.user}</span>
                      <span className="opacity-40">·</span>
                      <span>{formatMWTimeAgo(change.timestamp)}</span>
                    </div>
                    {change.comment && (
                      <p className="mt-1 line-clamp-1 text-[10px] leading-relaxed text-[var(--wikios-text-dim)] italic">
                        "{change.comment}"
                      </p>
                    )}
                  </div>
                </div>
                <span
                  className={`mt-0.5 ml-4 shrink-0 font-mono text-[10px] font-semibold ${diffClass}`}
                >
                  ({diffSign}
                  {diff.toLocaleString()})
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ===========================================================================
   STASHES TAB COMPONENT
   =========================================================================== */
function StashesSimulator() {
  const { data: stashes, isLoading } = api.wikios.getStashes.useQuery();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-5 w-5 animate-spin rounded-full border-b-2 border-[var(--wikios-accent)]" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bookmark className="h-4 w-4 text-[var(--wikios-accent)]" />
          <h3 className="text-sm font-bold text-[var(--wikios-text)]">Stash Manager Simulator</h3>
        </div>
        <span className="text-[10px] text-[var(--wikios-text-dim)]">Live stashes directory</span>
      </div>

      {stashes && stashes.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {stashes.map((stash) => (
            <StashCard key={stash.id} stash={stash} />
          ))}
        </div>
      ) : (
        <div className="wikios-card flex flex-col items-center justify-center gap-3 p-8 text-center">
          <FolderOpen className="h-10 w-10 text-[var(--wikios-text-dim)] opacity-20" />
          <h4 className="text-xs font-semibold text-[var(--wikios-text)]">No Stashes Found</h4>
          <p className="max-w-xs text-[10px] leading-relaxed text-[var(--wikios-text-muted)]">
            Go save some wiki pages or forum posts to load collections here.
          </p>
        </div>
      )}
    </div>
  );
}

function StashCard({
  stash,
}: {
  stash: { id: string; name: string; color: string; itemCount: number };
}) {
  const { depth, increaseDepth, resetDepth } = useFacetDepth(1);

  return (
    <div
      onMouseEnter={increaseDepth}
      onMouseLeave={resetDepth}
      className="wikios-card flex cursor-pointer flex-col gap-3 p-4 transition-transform"
      style={{
        transform: depth > 1 ? "translateY(-2px)" : "none",
        borderColor: stash.color ? `${stash.color}33` : "var(--wikios-border)",
      }}
    >
      <div className="flex items-center justify-between">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ background: stash.color || "var(--wikios-accent)" }}
          />
          <span className="truncate text-xs font-bold text-[var(--wikios-text)]">{stash.name}</span>
        </div>
        <span className="ml-3 flex shrink-0 items-center gap-0.5 text-[10px] text-[var(--wikios-text-muted)]">
          <Hash className="h-3 w-3" /> {stash.itemCount} items
        </span>
      </div>
      <p className="text-[10px] leading-relaxed text-[var(--wikios-text-dim)]">
        Scoped collection. Hovering over this card activates Facet dynamic elevation spring
        transitions.
      </p>
    </div>
  );
}

/* ===========================================================================
   WIKI EXAMPLES TAB COMPONENT
   =========================================================================== */
type WikiExampleType = "country" | "guide" | "live";

function WikiExamplesTab() {
  const [selectedWiki, setSelectedWiki] = useState<WikiExampleType>("country");
  const [searchTerm, setSearchTerm] = useState("");
  const [activeSearch, setActiveSearch] = useState("");

  const {
    data: liveArticle,
    isFetching,
    error,
  } = api.wikios.getArticleHtml.useQuery(
    { title: activeSearch },
    { enabled: !!activeSearch && selectedWiki === "live", retry: false }
  );

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      setActiveSearch(searchTerm.trim());
      setSelectedWiki("live");
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="wikios-card flex flex-col gap-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-[var(--wikios-accent)]" />
            <h3 className="text-sm font-bold text-[var(--wikios-text)]">WikiOS Render Examples</h3>
          </div>
          {/* Navigation options */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedWiki("country")}
              className={`rounded px-2.5 py-1 text-[10px] font-black tracking-wider uppercase ${
                selectedWiki === "country"
                  ? "border border-blue-500/30 bg-blue-500/15 text-blue-400"
                  : "border border-[var(--wikios-border)] text-[var(--wikios-text-muted)] hover:bg-black/5 dark:hover:bg-white/5"
              }`}
            >
              Mock Country Page
            </button>
            <button
              onClick={() => setSelectedWiki("guide")}
              className={`rounded px-2.5 py-1 text-[10px] font-black tracking-wider uppercase ${
                selectedWiki === "guide"
                  ? "border border-blue-500/30 bg-blue-500/15 text-blue-400"
                  : "border border-[var(--wikios-border)] text-[var(--wikios-text-muted)] hover:bg-black/5 dark:hover:bg-white/5"
              }`}
            >
              Mock Style Guide
            </button>
          </div>
        </div>

        {/* Live Wiki Search bar */}
        <form
          onSubmit={handleSearch}
          className="flex items-center gap-2 rounded border border-[var(--wikios-border)] bg-black/5 p-1.5 dark:bg-white/[0.01]"
        >
          <Search className="ml-2 h-4 w-4 shrink-0 text-[var(--wikios-text-dim)]" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Type live database page name (e.g. Main Page, France) to test preview..."
            className="flex-1 border-none bg-transparent px-2 text-xs text-[var(--wikios-text)] outline-none"
          />
          <button
            type="submit"
            disabled={isFetching && selectedWiki === "live"}
            className="rounded bg-[var(--wikios-accent)] px-3 py-1.5 text-[10px] font-extrabold tracking-wide text-white uppercase transition-colors hover:bg-[var(--wikios-accent-hover)] disabled:opacity-50"
          >
            {isFetching && selectedWiki === "live" ? "Fetching..." : "Live Preview"}
          </button>
        </form>

        <div className="mt-1 border-t border-[var(--wikios-border)] pt-4">
          {selectedWiki === "country" && <MockCountryProfile />}
          {selectedWiki === "guide" && <MockTechnicalGuidelines />}
          {selectedWiki === "live" && (
            <LiveWikiArticleView
              liveArticle={liveArticle}
              isFetching={isFetching}
              error={error}
              searchTitle={activeSearch}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function MockCountryProfile() {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
      <div className="flex flex-col gap-4 md:col-span-2">
        <h2 className="border-b border-[var(--wikios-border)] pb-1 text-xl font-bold text-[var(--wikios-text)]">
          Kapwa Republic
        </h2>
        <p className="text-xs leading-relaxed text-[var(--wikios-text)]">
          The <strong>Kapwa Republic</strong> is a sovereign nation located in the western region of
          the Aurora Ocean. Established in 1947 following the Concord Treaty, it represents a
          parliamentary system composed of eighty-two distinct states.
        </p>

        <h3 className="text-md mt-2 font-bold text-[var(--wikios-text)]">History</h3>
        <p className="text-xs leading-relaxed text-[var(--wikios-text-muted)]">
          Following the declaration of sovereignty, the provinces drafted their initial charter. The
          economy transitioned from traditional agriculture to a modular industrial powerhouse
          during the mid-20th century, spurred by massive technology infrastructure initiatives.
        </p>

        <h3 className="text-md mt-2 font-bold text-[var(--wikios-text)]">Governance & States</h3>
        <p className="text-xs leading-relaxed text-[var(--wikios-text-muted)]">
          The federation operates under a unicameral assembly, presided over by a chancellor elected
          by regional representatives. The local state laws are harmonized using centralized
          guideline treaties.
        </p>

        <h3 className="mt-3 text-xs font-bold tracking-wider text-[var(--wikios-text-dim)] uppercase">
          References
        </h3>
        <ol className="flex list-decimal flex-col gap-1 pl-4 text-[10px] text-[var(--wikios-text-dim)]">
          <li>Treaty of Concord historical records, Volume XII, pp. 142–155.</li>
          <li>Atlas of the Aurora Ocean geographical survey (2025 edition).</li>
        </ol>
      </div>

      {/* Right aligned Infobox Card */}
      <div className="wikios-card flex flex-col gap-3 self-start border border-[var(--wikios-border)] bg-black/10 p-4 dark:bg-white/[0.01]">
        <div className="rounded border border-blue-500/20 bg-blue-500/10 py-1.5 text-center text-xs font-bold tracking-wider text-blue-400 uppercase">
          Kapwa Republic
        </div>
        <table className="w-full border-collapse text-[10px] text-[var(--wikios-text)]">
          <tbody>
            <tr className="border-b border-[var(--wikios-border)]">
              <td className="py-1.5 pr-3 font-bold text-[var(--wikios-text-muted)]">Capital</td>
              <td className="py-1.5 text-right">Ogma City</td>
            </tr>
            <tr className="border-b border-[var(--wikios-border)]">
              <td className="py-1.5 pr-3 font-bold text-[var(--wikios-text-muted)]">Government</td>
              <td className="py-1.5 text-right">Federal Parliament</td>
            </tr>
            <tr className="border-b border-[var(--wikios-border)]">
              <td className="py-1.5 pr-3 font-bold text-[var(--wikios-text-muted)]">
                GDP (Nominal)
              </td>
              <td className="py-1.5 text-right">$1.24 Trillion</td>
            </tr>
            <tr className="border-b border-[var(--wikios-border)]">
              <td className="py-1.5 pr-3 font-bold text-[var(--wikios-text-muted)]">Population</td>
              <td className="py-1.5 text-right">48.2 Million</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MockTechnicalGuidelines() {
  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <h2 className="border-b border-[var(--wikios-border)] pb-1 text-xl font-bold text-[var(--wikios-text)]">
        WikiOS Style Guidelines
      </h2>
      <p className="text-xs leading-relaxed text-[var(--wikios-text)]">
        This document provides visual guidelines, layout directives, and styling constraints for
        constructing user-talk headers, infobox definitions, and category grids inside WikiOS.
      </p>

      <blockquote className="border-l-2 border-[var(--wikios-accent)] bg-black/5 py-2 pl-4 text-xs text-[var(--wikios-text-muted)] italic dark:bg-white/[0.01]">
        "Structured consistency across database articles ensures rapid comprehension of tactical,
        diplomatic, and financial summaries."
      </blockquote>

      <h3 className="text-md mt-2 font-bold text-[var(--wikios-text)]">Design Patterns</h3>
      <ul className="flex list-disc flex-col gap-1.5 pl-5 text-xs text-[var(--wikios-text-muted)]">
        <li>
          <strong>Typography:</strong> Page headings must use clean borders. Body copy should use
          adaptive dim text colors.
        </li>
        <li>
          <strong>Interactive Links:</strong> Wiki links should render with subtle text color
          transitions and visited state coloring.
        </li>
        <li>
          <strong>Glass Cards:</strong> Volumetric glare cards must remain semi-translucent,
          adapting glare reflectivity depending on active dark/light mode context.
        </li>
      </ul>
    </div>
  );
}

interface LiveWikiArticleViewProps {
  liveArticle: any;
  isFetching: boolean;
  error: any;
  searchTitle: string;
}

function LiveWikiArticleView({
  liveArticle,
  isFetching,
  error,
  searchTitle,
}: LiveWikiArticleViewProps) {
  if (isFetching) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-5 w-5 animate-spin rounded-full border-b-2 border-[var(--wikios-accent)]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="wikios-card flex flex-col items-center justify-center gap-3 border-red-500/20 bg-red-500/5 p-6 text-center text-red-600 dark:text-red-400">
        <AlertTriangle className="h-8 w-8 opacity-60" />
        <h4 className="text-xs font-semibold">Failed to Load Article</h4>
        <p className="max-w-xs text-[10px] opacity-80">
          "{searchTitle}" could not be retrieved from the MediaWiki database.
        </p>
      </div>
    );
  }

  if (!liveArticle) {
    return (
      <div className="rounded border border-dashed border-[var(--wikios-border)] p-8 text-center text-xs text-[var(--wikios-text-dim)]">
        Enter an article title in the search box above to load and render live database content.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
      <div className="flex flex-col gap-4 md:col-span-2">
        <h2 className="border-b border-[var(--wikios-border)] pb-1 text-xl font-bold text-[var(--wikios-text)]">
          {liveArticle.title}
        </h2>
        {liveArticle.noticesHtml && (
          <div
            className="wikios-notices rounded border border-blue-500/10 bg-blue-500/5 p-3 text-[10px]"
            dangerouslySetInnerHTML={{ __html: liveArticle.noticesHtml }}
          />
        )}
        <div
          className="wikios-content text-xs leading-relaxed text-[var(--wikios-text)]"
          dangerouslySetInnerHTML={{ __html: liveArticle.contentHtml }}
        />
      </div>

      {/* Right Infobox */}
      {liveArticle.infoboxHtml ? (
        <div className="self-start">
          <div
            className="wikios-card w-full overflow-hidden border border-[var(--wikios-border)] p-4 text-[10px]"
            dangerouslySetInnerHTML={{ __html: liveArticle.infoboxHtml }}
          />
        </div>
      ) : (
        <div className="wikios-card flex flex-col items-center justify-center gap-2 border-[var(--wikios-border)] p-4 text-center text-[var(--wikios-text-dim)]">
          <Info className="h-4 w-4 opacity-40" />
          <span className="text-[10px]">No infobox markup detected</span>
        </div>
      )}
    </div>
  );
}

/* ===========================================================================
   ANALYTICS TAB COMPONENT
   =========================================================================== */
function AnalyticsTab() {
  const { accent: accentColor, muted: mutedTextColor, tooltipProps } = useWikiChartColors();

  const { data: recentEdits } = api.wikios.getRecentChanges.useQuery(
    { limit: 30 },
    { staleTime: 30_000 }
  );
  const { data: stashes } = api.wikios.getStashes.useQuery();

  const mockTimeData = [
    { name: "00:00", Edits: 4 },
    { name: "04:00", Edits: 2 },
    { name: "08:00", Edits: 12 },
    { name: "12:00", Edits: 25 },
    { name: "16:00", Edits: 18 },
    { name: "20:00", Edits: 15 },
  ];

  const editVolumeData = (() => {
    if (!recentEdits || recentEdits.length === 0) return mockTimeData;
    const hours = Array(6).fill(0);
    recentEdits.forEach((edit) => {
      const date = new Date(edit.timestamp);
      const hour = date.getHours();
      const bucket = Math.min(Math.floor(hour / 4), 5);
      hours[bucket]++;
    });
    return [
      { name: "00:00", Edits: Math.max(hours[0], 2) },
      { name: "04:00", Edits: Math.max(hours[1], 1) },
      { name: "08:00", Edits: Math.max(hours[2], 5) },
      { name: "12:00", Edits: Math.max(hours[3], 9) },
      { name: "16:00", Edits: Math.max(hours[4], 7) },
      { name: "20:00", Edits: Math.max(hours[5], 4) },
    ];
  })();

  const stashPieData = (() => {
    if (!stashes || stashes.length === 0) {
      return [
        { name: "Military Intel", value: 8, color: "#f43f5e" },
        { name: "Economic Stats", value: 12, color: "#3b82f6" },
        { name: "Cultural History", value: 5, color: "#eab308" },
        { name: "Treaties & Pacts", value: 9, color: "#10b981" },
      ];
    }
    const colorsList = ["#3b82f6", "#10b981", "#eab308", "#f43f5e", "#a855f7", "#6366f1"];
    return stashes.map((s, idx) => ({
      name: s.name,
      value: s.itemCount || 1,
      color: s.color || colorsList[idx % colorsList.length],
    }));
  })();

  const contributorData = [
    { name: "OgmaAI", Edits: 142 },
    { name: "AlphaGov", Edits: 98 },
    { name: "BetaMod", Edits: 76 },
    { name: "WikiOSKeeper", Edits: 53 },
    { name: "StateBot", Edits: 32 },
  ];

  const byteChangeData = [
    { time: "Mon", Added: 5600, Removed: -1200 },
    { time: "Tue", Added: 4800, Removed: -800 },
    { time: "Wed", Added: 7200, Removed: -3400 },
    { time: "Thu", Added: 6100, Removed: -1900 },
    { time: "Fri", Added: 9500, Removed: -4500 },
    { time: "Sat", Added: 3400, Removed: -500 },
    { time: "Sun", Added: 4200, Removed: -900 },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Edits Over Time */}
        <div className="wikios-card flex flex-col gap-3 border-[var(--wikios-border)] p-4">
          <div className="flex items-center gap-1.5">
            <Activity className="h-4 w-4 text-[var(--wikios-accent)]" />
            <h4 className="text-xs font-bold tracking-wider text-[var(--wikios-text-muted)] uppercase">
              Recent Edits Trend (24h)
            </h4>
          </div>
          <WikiChart>
            <AreaChart data={editVolumeData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
              <defs>
                <linearGradient id="colorEdits" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={accentColor} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={accentColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="name" stroke={mutedTextColor} tickLine={false} />
              <YAxis stroke={mutedTextColor} tickLine={false} />
              <Tooltip {...tooltipProps} />
              <Area
                type="monotone"
                dataKey="Edits"
                stroke={accentColor}
                fillOpacity={1}
                fill="url(#colorEdits)"
              />
            </AreaChart>
          </WikiChart>
        </div>

        {/* Stash Category Pie Chart */}
        <div className="wikios-card flex flex-col gap-3 border-[var(--wikios-border)] p-4">
          <h4 className="text-xs font-bold tracking-wider text-[var(--wikios-text-muted)] uppercase">
            Stash Folder Distribution
          </h4>
          <div className="grid h-48 grid-cols-5 items-center gap-2">
            <div className="col-span-3 h-full w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip {...tooltipProps} />
                  <Pie
                    data={stashPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={65}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {stashPieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            {/* Legend Labels */}
            <div className="col-span-2 flex max-h-40 flex-col gap-1.5 overflow-y-auto pr-1">
              {stashPieData.map((entry, idx) => (
                <div key={idx} className="flex min-w-0 items-center gap-1.5 text-[9px]">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ background: entry.color }}
                  />
                  <span className="truncate font-medium text-[var(--wikios-text-muted)]">
                    {entry.name}
                  </span>
                  <span className="font-mono font-semibold text-[var(--wikios-text)]">
                    ({entry.value})
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Top Contributors */}
        <div className="wikios-card flex flex-col gap-3 border-[var(--wikios-border)] p-4">
          <h4 className="text-xs font-bold tracking-wider text-[var(--wikios-text-muted)] uppercase">
            Top Contributors volume
          </h4>
          <WikiChart>
            <BarChart data={contributorData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
              <XAxis dataKey="name" stroke={mutedTextColor} tickLine={false} />
              <YAxis stroke={mutedTextColor} tickLine={false} />
              <Tooltip {...tooltipProps} />
              <Bar dataKey="Edits" fill={accentColor} radius={[4, 4, 0, 0]} />
            </BarChart>
          </WikiChart>
        </div>

        {/* Byte Change size */}
        <div className="wikios-card flex flex-col gap-3 border-[var(--wikios-border)] p-4">
          <h4 className="text-xs font-bold tracking-wider text-[var(--wikios-text-muted)] uppercase">
            Byte Volume delta (Weekly)
          </h4>
          <WikiChart>
            <LineChart data={byteChangeData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <XAxis dataKey="time" stroke={mutedTextColor} tickLine={false} />
              <YAxis stroke={mutedTextColor} tickLine={false} />
              <Tooltip {...tooltipProps} />
              <Line
                type="monotone"
                dataKey="Added"
                stroke="#10b981"
                strokeWidth={2}
                dot={{ r: 2 }}
              />
              <Line
                type="monotone"
                dataKey="Removed"
                stroke="#ef4444"
                strokeWidth={2}
                dot={{ r: 2 }}
              />
            </LineChart>
          </WikiChart>
        </div>
      </div>
    </div>
  );
}
