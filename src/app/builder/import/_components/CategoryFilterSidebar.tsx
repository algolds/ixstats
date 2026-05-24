import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { Filter, Crown, ChevronUp } from "lucide-react";
import {
  GlassCard,
  GlassCardContent,
  GlassCardHeader,
} from "~/app/builder/components/glass/GlassCard";
import { cn } from "~/lib/utils";

interface WikiSite {
  name: string;
  displayName: string;
}

interface CategoryFilterSidebarProps {
  categoryFilter: string;
  setCategoryFilter: (filter: string) => void;
  popularCategories: string[];
  selectedSite: WikiSite;
  isExpanded: boolean;
  onToggle: () => void;
}

export const CategoryFilterSidebar: React.FC<CategoryFilterSidebarProps> = ({
  categoryFilter,
  setCategoryFilter,
  popularCategories,
  selectedSite,
  isExpanded,
  onToggle,
}) => {
  const guaranteedCategories = ["Countries", "Nations"];
  const combinedCategories = [
    ...guaranteedCategories,
    ...popularCategories.filter((cat) => !guaranteedCategories.includes(cat)),
  ];

  if (!isExpanded) {
    return (
      <button
        onClick={onToggle}
        className="sticky top-6 flex h-11 w-11 items-center justify-center rounded-xl border backdrop-blur-md transition-all duration-200 hover:scale-105"
        style={{
          backgroundColor: "var(--color-bg-secondary)",
          borderColor: "var(--color-border-primary)",
        }}
        title="Expand category filter"
      >
        <Filter className="h-5 w-5" style={{ color: "var(--color-text-secondary)" }} />
      </button>
    );
  }

  return (
    <GlassCard
      depth="elevated"
      blur="medium"
      theme="neutral"
      motionPreset="slide"
      className="sticky top-6"
    >
      <GlassCardHeader>
        <div className="flex w-full items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className="rounded-lg p-2"
              style={{
                backgroundColor: "var(--color-bg-accent)",
                borderColor: "var(--color-border-secondary)",
              }}
            >
              <Filter className="h-5 w-5" style={{ color: "var(--color-text-secondary)" }} />
            </div>
            <div>
              <h2 className="text-lg font-semibold" style={{ color: "var(--color-text-primary)" }}>
                Category Filter
              </h2>
              <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                Search any wiki category to find your page
              </p>
            </div>
          </div>
          <button
            onClick={onToggle}
            className="hover:bg-accent/50 rounded-md p-1.5 transition-colors"
            style={{ color: "var(--color-text-muted)" }}
          >
            <ChevronUp className="h-4 w-4" />
          </button>
        </div>
      </GlassCardHeader>
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <GlassCardContent>
              <div className="space-y-4">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="e.g., Countries, Nations, Cities..."
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className={cn(
                      "w-full rounded-lg border px-4 py-3 transition-all duration-200",
                      "focus:ring-brand-primary/50 focus:border-brand-primary/50 focus:ring-2 focus:outline-none"
                    )}
                    style={{
                      backgroundColor: "var(--color-bg-secondary)",
                      borderColor: "var(--color-border-primary)",
                      color: "var(--color-text-primary)",
                    }}
                  />
                </div>

                <div className="space-y-3">
                  <span
                    className="text-sm font-medium"
                    style={{ color: "var(--color-text-muted)" }}
                  >
                    Popular:
                  </span>
                  <div className="flex flex-col gap-2">
                    {combinedCategories.map((category) => (
                      <motion.button
                        key={category}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setCategoryFilter(category)}
                        className={cn(
                          "rounded-lg px-3 py-2 text-sm transition-all duration-200",
                          "border text-left font-medium",
                          categoryFilter === category
                            ? "border-border-secondary"
                            : "hover:border-border-secondary border-transparent"
                        )}
                        style={{
                          color:
                            categoryFilter === category
                              ? "var(--color-text-primary)"
                              : "var(--color-text-muted)",
                          backgroundColor:
                            categoryFilter === category
                              ? "var(--color-bg-accent)"
                              : "var(--color-bg-secondary)",
                        }}
                      >
                        {category}
                      </motion.button>
                    ))}
                  </div>
                </div>

                <div
                  className="border-t pt-4"
                  style={{ borderColor: "var(--color-border-primary)" }}
                >
                  <div
                    className="flex items-center gap-2 text-xs"
                    style={{ color: "var(--color-text-muted)" }}
                  >
                    <Crown className="h-3 w-3" />
                    <span>
                      Searching in <strong>Category:{categoryFilter}</strong> on{" "}
                      {selectedSite.displayName}
                      {selectedSite.name === "iiwiki" && <span> (including subcategories)</span>}
                    </span>
                  </div>
                </div>
              </div>
            </GlassCardContent>
          </motion.div>
        )}
      </AnimatePresence>
    </GlassCard>
  );
};
