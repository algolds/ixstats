import React from "react";
import { AlertCircle } from "lucide-react";

interface NoResultsStatusProps {
  searchTerm?: string;
  categoryFilter?: string;
  selectedSiteDisplayName?: string;
}

export const NoResultsStatus: React.FC<NoResultsStatusProps> = ({
  searchTerm,
  categoryFilter,
  selectedSiteDisplayName,
}) => {
  return (
    <>
      <AlertCircle className="text-text-muted mx-auto mb-2 h-6 w-6" />
      <p className="text-text-muted">
        No pages found for "{searchTerm}" in Category: {categoryFilter} on {selectedSiteDisplayName}
      </p>
      <p className="text-text-muted mt-1 text-sm">
        Try a different search term or check the other wiki source.
      </p>
    </>
  );
};
