import React from "react";
import { motion } from "motion/react";
import { ArrowLeft, Sparkles } from "lucide-react";
import { MyCountryLogo } from "~/components/ui/mycountry-logo";
import { cn } from "~/lib/utils";

interface ImportPageHeaderProps {
  onBackClick: () => void;
}

export const ImportPageHeader: React.FC<ImportPageHeaderProps> = ({ onBackClick }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-8 flex items-center gap-6"
    >
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={onBackClick}
        className={cn(
          "flex items-center gap-2 rounded-lg px-4 py-2",
          "border backdrop-blur-sm transition-all duration-200"
        )}
        style={{
          backgroundColor: "var(--color-bg-secondary)",
          borderColor: "var(--color-border-primary)",
          color: "var(--color-text-muted)",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = "var(--color-text-primary)";
          e.currentTarget.style.backgroundColor = "var(--color-bg-elevated)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = "var(--color-text-muted)";
          e.currentTarget.style.backgroundColor = "var(--color-bg-secondary)";
        }}
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Builder
      </motion.button>

      <div className="h-8 w-px" style={{ backgroundColor: "var(--color-border-primary)" }} />

      <div className="flex items-center gap-4">
        <MyCountryLogo size="lg" animated />
        <div>
          <div className="flex items-center gap-2">
            <h1 className="bg-gradient-to-r from-amber-400 to-amber-600 bg-clip-text text-3xl font-bold text-transparent">
              MyCountry Builder
            </h1>
            <Sparkles className="h-6 w-6 text-amber-500" />
          </div>
          <p className="mt-1 text-sm" style={{ color: "var(--color-text-muted)" }}>
            Import your country data from wiki sources or select an eligible country below to start building.
          </p>
        </div>
      </div>
    </motion.div>
  );
};
