import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Globe, ExternalLink } from "lucide-react";
import {
  GlassCard,
  GlassCardContent,
  GlassCardHeader,
} from "~/app/builder/components/glass/GlassCard";
import { BorderBeam } from "~/components/magicui/border-beam";
import { cn } from "~/lib/utils";
import { withBasePath } from "~/lib/base-path";

interface WikiSite {
  name: string;
  displayName: string;
  baseUrl: string;
  description: string;
  categoryFilter?: string;
  theme: "blue" | "indigo";
  gradient: string;
}

interface WikiSourceSelectorProps {
  wikiSites: WikiSite[];
  selectedSite: WikiSite;
  onSelectSite: (site: WikiSite) => void;
}

export const WikiSourceSelector: React.FC<WikiSourceSelectorProps> = ({
  wikiSites,
  selectedSite,
  onSelectSite,
}) => {
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);

  return (
    <GlassCard depth="elevated" blur="medium" theme="neutral" motionPreset="slide" className="mb-8">
      <GlassCardHeader>
        <div className="flex items-center gap-3">
          <div
            className="rounded-lg p-2"
            style={{
              backgroundColor: "var(--color-bg-accent)",
              borderColor: "var(--color-border-secondary)",
            }}
          >
            <Globe className="h-5 w-5" style={{ color: "var(--color-text-secondary)" }} />
          </div>
          <div>
            <h2 className="text-lg font-semibold" style={{ color: "var(--color-text-primary)" }}>
              Choose Wiki Source
            </h2>
            <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
              Select your preferred wiki encyclopedia
            </p>
          </div>
        </div>
      </GlassCardHeader>
      <GlassCardContent>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {wikiSites.map((site) => (
            <motion.div
              key={site.name}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="relative"
              onMouseEnter={() => setHoveredCard(site.name)}
              onMouseLeave={() => setHoveredCard(null)}
            >
              <button
                onClick={() => onSelectSite(site)}
                className={cn(
                  "relative flex h-full w-full flex-col overflow-hidden rounded-xl border p-6 text-left transition-all duration-300",
                  "bg-gradient-to-br",
                  site.gradient,
                  selectedSite.name === site.name
                    ? `border-${site.theme}-400/50 shadow-lg`
                    : "hover:shadow-md"
                )}
                style={{
                  backgroundColor:
                    selectedSite.name === site.name
                      ? `rgba(${site.theme === "blue" ? "59, 130, 246" : "99, 102, 241"}, 0.1)`
                      : "var(--color-bg-secondary)",
                  borderColor:
                    selectedSite.name === site.name
                      ? `rgba(${site.theme === "blue" ? "59, 130, 246" : "99, 102, 241"}, 0.5)`
                      : "var(--color-border-primary)",
                  boxShadow:
                    selectedSite.name === site.name
                      ? `0 8px 25px rgba(${site.theme === "blue" ? "59, 130, 246" : "99, 102, 241"}, 0.2)`
                      : undefined,
                }}
              >
                {/* Logos that fill the card */}
                <AnimatePresence>
                  {(hoveredCard === site.name || selectedSite.name === site.name) && (
                    <motion.div
                      initial={{ opacity: 0, filter: "blur(4px)" }}
                      animate={{ opacity: 1, filter: "blur(0px)" }}
                      exit={{ opacity: 0, filter: "blur(4px)" }}
                      transition={{ duration: 0.3 }}
                      className="absolute inset-0 h-full w-full"
                    >
                      {site.name === "althistory" && (
                        <img
                          src={withBasePath("/images/althistory-logo.webp")}
                          alt="AltHistory"
                          className="absolute inset-0 m-auto h-2/3 w-2/3 object-contain opacity-50"
                        />
                      )}
                      {site.name === "iiwiki" && (
                        <img
                          src={withBasePath("/images/IIWikiLogo.png")}
                          alt="IIWiki"
                          className="absolute inset-0 m-auto h-2/3 w-2/3 object-contain opacity-50"
                        />
                      )}
                      {site.name === "ixwiki" && (
                        <img
                          src={withBasePath("/images/ix-logo.svg")}
                          alt="IXWiki"
                          className="absolute inset-0 m-auto h-3/3 w-3/3 object-contain opacity-50"
                        />
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="relative z-10 mb-3 flex items-center justify-between">
                  <h3 className="font-semibold" style={{ color: "var(--color-text-primary)" }}>
                    {site.displayName}
                  </h3>
                  <ExternalLink className="h-4 w-4" style={{ color: "var(--color-text-muted)" }} />
                </div>
                <p
                  className="relative z-10 text-sm leading-relaxed"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  {site.description}
                </p>

                {selectedSite.name === site.name && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="absolute -inset-px rounded-xl"
                  >
                    <BorderBeam size={120} duration={8} />
                  </motion.div>
                )}
              </button>
            </motion.div>
          ))}
        </div>
      </GlassCardContent>
    </GlassCard>
  );
};
