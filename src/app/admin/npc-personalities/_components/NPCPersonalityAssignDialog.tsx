"use client";
// src/app/admin/npc-personalities/_components/NPCPersonalityAssignDialog.tsx

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";

interface NPCPersonalityAssignDialogProps {
  isOpen: boolean;
  onClose: () => void;
  personality: any;
  countryId: string;
  setCountryId: (id: string) => void;
  reason: string;
  setReason: (reason: string) => void;
  onAssign: () => void;
  isPending: boolean;
}

export function NPCPersonalityAssignDialog({
  isOpen,
  onClose,
  personality,
  countryId,
  setCountryId,
  reason,
  setReason,
  onAssign,
  isPending,
}: NPCPersonalityAssignDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Assign Personality to Country</DialogTitle>
          <DialogDescription>
            Assign &quot;{personality?.name}&quot; to a country to govern its automated diplomatic
            actions.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="text-foreground mb-1.5 block text-xs font-medium">Country ID *</label>
            <Input
              value={countryId}
              onChange={(e) => setCountryId(e.target.value)}
              placeholder="e.g., urcea or caphiria"
              className="text-xs"
            />
          </div>

          <div>
            <label className="text-foreground mb-1.5 block text-xs font-medium">
              Assignment Reason
            </label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Optional notes or historical rationale..."
              rows={3}
              className="text-xs"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="text-xs active:scale-[0.98]">
            Cancel
          </Button>
          <Button
            onClick={onAssign}
            disabled={!countryId.trim() || isPending}
            className="text-xs active:scale-[0.98]"
          >
            {isPending ? "Assigning..." : "Assign Personality"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
