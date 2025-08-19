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
      <AlertCircle className="h-6 w-6 mx-auto mb-2 text-text-muted" />
      <p className="text-text-muted">
        No pages found for "{searchTerm}" in Category: {categoryFilter} on {selectedSiteDisplayName}
      </p>
      <p className="text-sm text-text-muted mt-1">
        Try a different search term or check the other wiki source.
      </p>
    </>
  );
};
