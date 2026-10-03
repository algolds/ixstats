"use client";
// src/app/admin/membership/MembershipPanel.tsx
// Membership Tier Management Panel with Facet design tokens

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
import { User, Check, WarningCircle as AlertCircle } from "iconoir-react";
import { PageHeader } from "~/components/shell/PageHeader";
import { Card } from "~/components/ui/card";

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
      <PageHeader
        title="Membership tiers"
        subtitle="Change user tiers and grant MyCountry Executive or Premium access."
      />

      <div className="mx-auto max-w-xl">
        <Card className="space-y-5 p-5">
          {user && (
            <div className="border-separator bg-fill-3 rounded-row flex items-center justify-between border p-3">
              <div className="flex items-center gap-3">
                <div className="bg-tint-fill border-tint/20 rounded-control border p-2">
                  <User className="text-tint h-5 w-5" />
                </div>
                <div>
                  <p className="text-label text-caption">Current session</p>
                  <p className="text-label-secondary text-footnote font-mono">{user.id}</p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={upgradeSelf}>
                Use My ID
              </Button>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="text-label text-caption mb-2 block">User ID *</label>
              <Input
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder="user_..."
                className="rounded-control-sm md:text-footnote h-(--control-height-sm) font-mono"
              />
            </div>

            <div>
              <label className="text-label text-caption mb-2 block">Target membership tier</label>
              <Select value={tier} onValueChange={(val: any) => setTier(val)}>
                <SelectTrigger size="sm">
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
                className={`rounded-row text-footnote flex items-center gap-2 border p-3 ${
                  message.type === "success"
                    ? "border-green/20 bg-green/10 text-green"
                    : "border-red/20 bg-red/10 text-red"
                }`}
              >
                {message.type === "success" ? (
                  <Check className="text-green h-4 w-4 shrink-0" />
                ) : (
                  <AlertCircle className="text-red h-4 w-4 shrink-0" />
                )}
                <span>{message.text}</span>
              </div>
            )}

            <Button
              onClick={handleUpdateMembership}
              disabled={updateMembershipMutation.isPending || !userId.trim()}
              className="w-full"
            >
              {updateMembershipMutation.isPending ? "Updating Tier..." : "Apply Membership Tier"}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
