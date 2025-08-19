import React from "react";
import { motion } from "framer-motion";
import { Loader2, CheckCircle } from "lucide-react";
import { MyCountryLogo } from "~/components/ui/mycountry-logo";

interface DynamicIslandStatusProps {
  selectedResultTitle: string | undefined;
  selectedCountryFlag: string | null;
  isLoading: boolean;
}

export const DynamicIslandStatus: React.FC<DynamicIslandStatusProps> = ({
  selectedResultTitle,
  selectedCountryFlag,
  isLoading,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50"
    >
      <div
        className="flex items-center gap-3 px-6 py-3 rounded-full shadow-lg backdrop-blur-md border"
        style={{
          backgroundColor: 'var(--color-bg-surface)/80',
          borderColor: 'var(--color-border-primary)',
          color: 'var(--color-text-primary)'
        }}
      >
        {isLoading ? (
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          >
            <Loader2 className="h-5 w-5 text-text-secondary" />
          </motion.div>
        ) : (
          <CheckCircle className="h-5 w-5 text-green-500" />
        )}
        {selectedCountryFlag ? (
          <img
            src={selectedCountryFlag}
            alt="Country Flag"
            className="w-6 h-4 object-cover rounded-sm border border-border-secondary shadow-sm"
          />
        ) : (
          <MyCountryLogo className="h-5 w-5" />
        )}
        <span className="font-medium">
          {isLoading ? `Parsing ${selectedResultTitle}...` : `Parsed ${selectedResultTitle}`}
        </span>
      </div>
    </motion.div>
  );
};
