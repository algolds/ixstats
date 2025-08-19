import React from "react";
import { Loader2 } from "lucide-react";

interface LoadingStatusProps {
  searchTerm?: string;
}

export const LoadingStatus: React.FC<LoadingStatusProps> = ({ searchTerm }) => (
  <div className="flex flex-col items-center justify-center space-y-4">
    <Loader2 className="h-8 w-8 animate-spin text-text-secondary" />
    <div className="text-center">
      <p className="font-semibold text-text-primary">Parsing {searchTerm}...</p>
      <p className="text-sm text-text-muted">Please wait while we extract the data.</p>
    </div>
  </div>
);