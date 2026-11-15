"use client";
// src/app/admin/user-roles/InviteUserDialog.tsx
// Waitlist bypass invitation: trigger button, form and send mutation

import { useState } from "react";
import { Mail } from "iconoir-react";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "~/components/ui/dialog";
import { useNotify } from "~/hooks/useNotify";

interface InviteUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InviteUserDialog({ open, onOpenChange }: InviteUserDialogProps) {
  const notify = useNotify();

  const [inviteForm, setInviteForm] = useState({
    emailAddress: "",
    reservedNationName: "",
    role: "user" as "admin" | "user" | "owner",
  });

  const inviteUserMutation = api.admin.inviteUserToBypassWaitlist.useMutation({
    onSuccess: (result) => {
      notify.success("Success", result.message || "Invitation sent successfully");
      onOpenChange(false);
      setInviteForm({
        emailAddress: "",
        reservedNationName: "",
        role: "user",
      });
    },
    onError: (error: { message?: string }) => {
      notify.error("Error", error.message || "Failed to send invitation");
    },
  });

  const handleSendInvite = () => {
    if (!inviteForm.emailAddress || !inviteForm.reservedNationName) {
      notify.error("Validation Error", "Email address and reserved nation name are required");
      return;
    }
    inviteUserMutation.mutate(inviteForm);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Mail className="mr-1.5 h-3.5 w-3.5" />
          Invite VIP / Role
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Send waitlist bypass invitation</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-3">
          <div className="space-y-2">
            <label className="text-label text-caption">Email address</label>
            <Input
              type="email"
              value={inviteForm.emailAddress}
              onChange={(e) => setInviteForm({ ...inviteForm, emailAddress: e.target.value })}
              placeholder="player@domain.com"
              className="rounded-control-sm md:text-footnote h-(--control-height-sm)"
            />
          </div>
          <div className="space-y-2">
            <label className="text-label text-caption">Reserved nation name</label>
            <Input
              value={inviteForm.reservedNationName}
              onChange={(e) => setInviteForm({ ...inviteForm, reservedNationName: e.target.value })}
              placeholder="Kingdom of Solaria"
              className="rounded-control-sm md:text-footnote h-(--control-height-sm)"
            />
          </div>
          <div className="space-y-2">
            <label className="text-label text-caption">Initial role</label>
            <Select
              value={inviteForm.role}
              onValueChange={(val: "admin" | "user" | "owner") =>
                setInviteForm({ ...inviteForm, role: val })
              }
            >
              <SelectTrigger size="sm">
                <SelectValue placeholder="Choose a role..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">Standard Player (User)</SelectItem>
                <SelectItem value="admin">Administrator (Admin)</SelectItem>
                <SelectItem value="owner">System Owner (Owner)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSendInvite}
            disabled={
              inviteUserMutation.isPending ||
              !inviteForm.emailAddress ||
              !inviteForm.reservedNationName
            }
          >
            {inviteUserMutation.isPending ? "Sending..." : "Send Invitation"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
