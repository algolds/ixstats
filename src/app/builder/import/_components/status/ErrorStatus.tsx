import React from "react";
import { AlertCircle } from "lucide-react";

interface ErrorStatusProps {
  error?: string;
}

export const ErrorStatus: React.FC<ErrorStatusProps> = ({ error }) => {
  return (
    <>
      <AlertCircle className="text-var(--color-error) h-5 w-5 flex-shrink-0" />
      <p className="text-red-200">{error}</p>
    </>
  );
};
