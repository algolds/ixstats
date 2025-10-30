"use client";

import { useState } from "react";
import { api } from "~/trpc/react";
import { useUser } from "~/context/auth-context";
import { GlassButton } from "~/components/ui/glass-button";
import { Crown, User, Check, AlertCircle } from "lucide-react";

export default function MembershipAdminPage() {
  const { user } = useUser();
  const [userId, setUserId] = useState("");
  const [tier, setTier] = useState<"basic" | "mycountry_premium">("mycountry_premium");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const updateMembershipMutation = api.users.updateMembershipTier.useMutation({
    onSuccess: (data) => {
      setMessage(`✅ ${data.message}`);
      setIsLoading(false);
    },
    onError: (error) => {
      setMessage(`❌ Error: ${error.message}`);
      setIsLoading(false);
    },
  });

  const handleUpdateMembership = async () => {
    if (!userId.trim()) {
      setMessage("❌ Please enter a User ID");
      return;
    }

    setIsLoading(true);
    setMessage("");

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
    <div className="container mx-auto max-w-2xl px-4 py-8">
      <div className="glass-panel space-y-6 p-8">
        {/* Header */}
        <div className="space-y-4 text-center">
          <div className="flex justify-center">
            <Crown className="h-12 w-12 text-yellow-400" />
          </div>
          <h1 className="text-3xl font-bold text-white">Membership Tier Management</h1>
          <p className="text-white/80">Update user membership tiers for testing premium features</p>
        </div>

        {/* Quick Actions */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-white">Quick Actions</h2>

          <div className="flex flex-col gap-3 sm:flex-row">
            <GlassButton variant="primary" onClick={upgradeSelf} className="flex-1">
              <Crown className="mr-2 h-4 w-4" />
              Upgrade Myself to Premium
            </GlassButton>

            <GlassButton
              variant="secondary"
              onClick={() => {
                if (user?.id) {
                  setUserId(user.id);
                  setTier("basic");
                }
              }}
              className="flex-1"
            >
              <User className="mr-2 h-4 w-4" />
              Downgrade Myself to Basic
            </GlassButton>
          </div>
        </div>

        {/* Manual Update */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-white">Manual Update</h2>

          <div className="space-y-4">
            <div>
              <label htmlFor="userId" className="mb-2 block text-sm font-medium text-white/90">
                User ID (Clerk User ID)
              </label>
              <input
                id="userId"
                type="text"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder="user_..."
                className="w-full rounded-lg border border-white/20 bg-black/20 px-4 py-3 text-white placeholder-white/50 focus:border-blue-400 focus:outline-none"
              />
              {user?.id && <p className="mt-1 text-sm text-white/60">Your User ID: {user.id}</p>}
            </div>

            <div>
              <label htmlFor="tier" className="mb-2 block text-sm font-medium text-white/90">
                Membership Tier
              </label>
              <select
                id="tier"
                value={tier}
                onChange={(e) => setTier(e.target.value as "basic" | "mycountry_premium")}
                className="w-full rounded-lg border border-white/20 bg-black/20 px-4 py-3 text-white focus:border-blue-400 focus:outline-none"
              >
                <option value="basic">Basic (Free)</option>
                <option value="mycountry_premium">MyCountry Premium</option>
              </select>
            </div>

            <GlassButton
              variant="primary"
              onClick={handleUpdateMembership}
              disabled={isLoading}
              className="w-full"
            >
              {isLoading ? (
                <>
                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-b-2 border-white"></div>
                  Updating...
                </>
              ) : (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Update Membership Tier
                </>
              )}
            </GlassButton>
          </div>
        </div>

        {/* Status Message */}
        {message && (
          <div
            className={`rounded-lg border p-4 ${
              message.includes("✅")
                ? "border-green-400/30 bg-green-500/10 text-green-200"
                : "border-red-400/30 bg-red-500/10 text-red-200"
            }`}
          >
            <div className="flex items-center">
              {message.includes("✅") ? (
                <Check className="mr-2 h-5 w-5" />
              ) : (
                <AlertCircle className="mr-2 h-5 w-5" />
              )}
              {message}
            </div>
          </div>
        )}

        {/* Info */}
        <div className="rounded-lg border border-blue-400/30 bg-blue-500/10 p-4">
          <h3 className="mb-2 font-semibold text-blue-200">Premium Features</h3>
          <ul className="space-y-1 text-sm text-blue-200/80">
            <li>• SDI (Sovereign Digital Interface) - Intelligence and crisis management</li>
            <li>• ECI (Executive Command Interface) - AI-powered policy management</li>
            <li>• Advanced intelligence feeds and secure messaging</li>
            <li>• Real-time crisis monitoring and response tools</li>
            <li>• Diplomatic communications and economic intelligence</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
