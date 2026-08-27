// src/app/admin/membership/MembershipPanel.tsx
// Membership Tier Management Panel with Facet design tokens
"use client";

import { useState } from "react";
import { api } from "~/trpc/react";
import { useUser } from "~/context/auth-context";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Crown, User, Check, WarningCircle as AlertCircle } from "iconoir-react";
import { AdminHeader } from "../_components/AdminHeader";

export function MembershipPanel() {
  const { user } = useUser();
  const [userId, setUserId] = useState("");
  const [tier, setTier] = useState<"basic" | "mycountry_premium">("mycountry_premium");
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const updateMembershipMutation = api.users.updateMembershipTier.useMutation({
    onSuccess: (data) => {
      setMessage({ text: data.message, type: "success" });
    },
    onError: (error) => {
      setMessage({ text: error.message, type: "error" });
    },
  });

  const handleUpdateMembership = () => {
    if (!userId.trim()) {
      setMessage({ text: "Please enter a User ID", type: "error" });
      return;
    }

    setMessage(null);
    updateMembershipMutation.mutate({
      userId: userId.trim(),
      tier,
    });
  };

  const upgradeSelf = () => {
    if (user?.id) {
      setUserId(user.id);
      setTier("mycountry_premium");
    }
  };

  return (
    <div className="space-y-6">
      <AdminHeader
        icon={Crown}
        title="Membership Tier Management"
        description="Update user membership tiers and grant MyCountry Executive / Premium subscription entitlements."
      />

      <div className="mx-auto max-w-xl">
        <div className="border-border/30 bg-card/25 space-y-5 rounded-2xl border p-5 shadow-xs backdrop-blur-md">
          {user && (
            <div className="border-border/30 bg-background/40 flex items-center justify-between rounded-xl border p-3">
              <div className="flex items-center gap-3">
                <div className="bg-primary/10 border-primary/20 rounded-lg border p-2">
                  <User className="text-primary h-5 w-5" />
                </div>
                <div>
                  <p className="text-foreground text-xs font-semibold">Current Session</p>
                  <p className="text-muted-foreground font-mono text-[11px]">{user.id}</p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={upgradeSelf}
                className="text-xs active:scale-[0.98]"
              >
                Use My ID
              </Button>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="text-foreground mb-1.5 block text-xs font-medium">User ID *</label>
              <Input
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder="user_..."
                className="font-mono text-xs"
              />
            </div>

            <div>
              <label className="text-foreground mb-1.5 block text-xs font-medium">
                Target Membership Tier
              </label>
              <Select value={tier} onValueChange={(val: any) => setTier(val)}>
                <SelectTrigger className="text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="basic">Basic (Free Tier)</SelectItem>
                  <SelectItem value="mycountry_premium">
                    MyCountry Premium (Executive Suite)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {message && (
              <div
                className={`flex items-center gap-2 rounded-xl border p-3 text-xs ${
                  message.type === "success"
                    ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
                    : "border-red-500/20 bg-red-500/10 text-red-300"
                }`}
              >
                {message.type === "success" ? (
                  <Check className="h-4 w-4 shrink-0 text-emerald-400" />
                ) : (
                  <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
                )}
                <span>{message.text}</span>
              </div>
            )}

            <Button
              onClick={handleUpdateMembership}
              disabled={updateMembershipMutation.isPending || !userId.trim()}
              className="w-full text-xs active:scale-[0.98]"
            >
              {updateMembershipMutation.isPending ? "Updating Tier..." : "Apply Membership Tier"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default MembershipPanel;
