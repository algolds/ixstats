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
      className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2"
    >
      <div
        className="flex items-center gap-3 rounded-full border px-6 py-3 shadow-lg backdrop-blur-md"
        style={{
          backgroundColor: "var(--color-bg-surface)/80",
          borderColor: "var(--color-border-primary)",
          color: "var(--color-text-primary)",
        }}
      >
        {isLoading ? (
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          >
            <Loader2 className="text-text-secondary h-5 w-5" />
          </motion.div>
        ) : (
          <CheckCircle className="h-5 w-5 text-green-500" />
        )}
        {selectedCountryFlag ? (
          <img
            src={selectedCountryFlag}
            alt="Country Flag"
            className="border-border-secondary h-4 w-6 rounded-sm border object-cover shadow-sm"
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
