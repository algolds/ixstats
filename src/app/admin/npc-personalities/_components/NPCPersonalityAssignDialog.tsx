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
          <DialogTitle>Assign personality to country</DialogTitle>
          <DialogDescription>
            Assign &quot;{personality?.name}&quot; to a country to govern its automated diplomatic
            actions.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="text-label text-caption mb-2 block">Country ID *</label>
            <Input
              value={countryId}
              onChange={(e) => setCountryId(e.target.value)}
              placeholder="e.g., urcea or caphiria"
              className="rounded-control-sm md:text-footnote h-(--control-height-sm)"
            />
          </div>

          <div>
            <label className="text-label text-caption mb-2 block">Assignment reason</label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Optional notes or historical rationale..."
              rows={3}
              className="md:text-footnote"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onAssign} disabled={!countryId.trim() || isPending}>
            {isPending ? "Assigning..." : "Assign Personality"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
