"use client";

import { useState, type ReactNode } from "react";
import { ShieldAlert, Clock } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";

interface NationalSecurityModalProps {
  children: ReactNode;
  mode?: "dashboard" | "report" | "protocols";
  threatId?: string;
}

export function NationalSecurityModal({ children }: NationalSecurityModalProps) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-red-600" />
            National Security Center
          </DialogTitle>
          <DialogDescription>
            Threat reporting and response workflows are on the way.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6 pt-2 text-center">
          <Badge variant="outline" className="mx-auto w-fit">
            Coming Soon
          </Badge>
          <div className="flex flex-col items-center gap-4">
            <div className="bg-muted rounded-full p-4">
              <Clock className="text-muted-foreground h-8 w-8" />
            </div>
            <p className="text-muted-foreground text-sm">
              We&apos;re finishing the integrated threat management system, including incident
              reporting, mitigation protocols, and live situational awareness.
            </p>
          </div>
          <Button disabled className="w-full sm:w-auto">
            Notify Me When Ready
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
