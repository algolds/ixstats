import React from "react";
import { AlertCircle } from "lucide-react";

interface ErrorStatusProps {
  error?: string;
}

export const ErrorStatus: React.FC<ErrorStatusProps> = ({ error }) => {
  return (
    <>
      <AlertCircle className="h-5 w-5 text-var(--color-error) flex-shrink-0" />
      <p className="text-red-200">{error}</p>
    </>
  );
};
