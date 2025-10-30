"use client";

import React, { useState } from "react";
import { useUser } from "~/context/auth-context";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { TrendRiskAnalytics } from "~/components/analytics/TrendRiskAnalytics";
import { BarChart3 } from "lucide-react";

interface TrendRiskAnalyticsModalProps {
  children: React.ReactNode;
  countryId: string;
}

export function TrendRiskAnalyticsModal({ children, countryId }: TrendRiskAnalyticsModalProps) {
  const { user } = useUser();
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent
        style={{
          width: "100vw",
          maxWidth: "100vw",
          height: "100vh",
          maxHeight: "100vh",
          padding: "24px",
          margin: "0px",
          overflowY: "auto",
        }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-orange-500" />
            Advanced Analytics Dashboard
          </DialogTitle>
          <DialogDescription>
            Comprehensive trend analysis, risk assessment, and volatility monitoring for informed
            decision-making.
          </DialogDescription>
        </DialogHeader>

        <TrendRiskAnalytics countryId={countryId} userId={user?.id} />
      </DialogContent>
    </Dialog>
  );
}
