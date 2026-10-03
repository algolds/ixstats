"use client";

import React, { memo } from "react";
import { Card } from "~/components/ui/card";

interface StepContentProps {
  children: React.ReactNode;
}

/** The card that frames the active builder or editor section; section forms render their own cards inside it. */
export const StepContent = memo(function StepContent({ children }: StepContentProps) {
  return (
    <div className="mx-auto w-full max-w-6xl">
      <Card className="p-6 sm:p-8">{children}</Card>
    </div>
  );
});
