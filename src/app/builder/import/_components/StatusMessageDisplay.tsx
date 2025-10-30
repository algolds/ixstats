import React from "react";
import { GlassCard, GlassCardContent } from "~/app/builder/components/glass/GlassCard";
import { SearchingStatus } from "./status/SearchingStatus";
import { NoResultsStatus } from "./status/NoResultsStatus";
import { ErrorStatus } from "./status/ErrorStatus";
import { LoadingStatus } from "./status/LoadingStatus";

interface StatusMessageDisplayProps {
  type: "searching" | "no-results" | "error" | "loading";
  searchTerm?: string;
  categoryFilter?: string;
  selectedSiteDisplayName?: string;
  isIiwiki?: boolean;
  error?: string;
}

export const StatusMessageDisplay: React.FC<StatusMessageDisplayProps> = ({
  type,
  searchTerm,
  categoryFilter,
  selectedSiteDisplayName,
  isIiwiki,
  error,
}) => {
  let content;

  let motionPreset: "fade" | "slide" | "scale" = "fade";
  let theme: "neutral" | "red" = "neutral";

  switch (type) {
    case "searching":
      content = (
        <SearchingStatus
          searchTerm={searchTerm}
          categoryFilter={categoryFilter}
          selectedSiteDisplayName={selectedSiteDisplayName}
        />
      );
      motionPreset = "scale";
      break;
    case "no-results":
      content = (
        <NoResultsStatus
          searchTerm={searchTerm}
          categoryFilter={categoryFilter}
          selectedSiteDisplayName={selectedSiteDisplayName}
        />
      );
      motionPreset = "fade";
      break;
    case "error":
      content = <ErrorStatus error={error} />;
      motionPreset = "slide";
      theme = "red";
      break;
  }

  return (
    <GlassCard depth="elevated" blur="medium" theme={theme} motionPreset={motionPreset}>
      <GlassCardContent className="py-12 text-center">{content}</GlassCardContent>
    </GlassCard>
  );
};
