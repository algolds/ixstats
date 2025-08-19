import React from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, Sparkles } from "lucide-react";
import { createUrl } from "~/lib/url-utils";
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
      className="flex items-center gap-6 mb-24"
    >
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={onBackClick}
        className={cn(
          "flex items-center gap-2 px-4 py-2 rounded-lg",
          "border transition-all duration-200 backdrop-blur-sm"
        )}
        style={{
          backgroundColor: 'var(--color-bg-secondary)',
          borderColor: 'var(--color-border-primary)',
          color: 'var(--color-text-muted)'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = 'var(--color-text-primary)';
          e.currentTarget.style.backgroundColor = 'var(--color-bg-elevated)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = 'var(--color-text-muted)';
          e.currentTarget.style.backgroundColor = 'var(--color-bg-secondary)';
        }}
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Builder
      </motion.button>

      <div
        className="h-8 w-px"
        style={{ backgroundColor: 'var(--color-border-primary)' }}
      />

      <div className="flex items-center gap-4">
        <MyCountryLogo size="lg" animated />
        <div>
          <div className="flex items-center gap-2">
            <h1
              className="text-3xl font-bold bg-gradient-to-r from-amber-400 to-amber-600 bg-clip-text text-transparent"
            >
              Country Importer
            </h1>
            <Sparkles className="h-6 w-6 text-text-secondary" />
          </div>
          <p
            className="mt-1"
            style={{ color: 'var(--color-text-muted)' }}
          >
            Import country data from multiple wiki sources
          </p>
          <p
            className="mt-1"
            style={{ color: 'var(--color-text-muted)' }}
          >
            automatic flag & Coat of Arms
          </p>
        </div>
      </div>
    </motion.div>
  );
};