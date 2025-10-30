import React from "react";
import { Loader2 } from "lucide-react";

interface LoadingStatusProps {
  searchTerm?: string;
}

export const LoadingStatus: React.FC<LoadingStatusProps> = ({ searchTerm }) => (
  <div className="flex flex-col items-center justify-center space-y-4">
    <Loader2 className="text-text-secondary h-8 w-8 animate-spin" />
    <div className="text-center">
      <p className="text-text-primary font-semibold">Parsing {searchTerm}...</p>
      <p className="text-text-muted text-sm">Please wait while we extract the data.</p>
    </div>
  </div>
);
