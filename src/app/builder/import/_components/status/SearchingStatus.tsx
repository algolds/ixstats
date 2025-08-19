import React from "react";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";

interface SearchingStatusProps {
  searchTerm?: string;
  categoryFilter?: string;
  selectedSiteDisplayName?: string;
}

export const SearchingStatus: React.FC<SearchingStatusProps> = ({
  searchTerm,
  categoryFilter,
  selectedSiteDisplayName,
}) => {
  return (
    <>
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        className="inline-block mb-4"
      >
        <Loader2 className="h-8 w-8 text-text-secondary" />
      </motion.div>
      <p className="text-text-muted">
        Searching for "{searchTerm}" on {selectedSiteDisplayName}...
      </p>
      <p className="text-text-muted">
        Results may take several seconds to load.
      </p>
    </>
  );
};
