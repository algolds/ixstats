"use client";

import { useState } from 'react';
import { api } from '~/trpc/react';
import { useUser } from '~/context/auth-context';
import { GlassButton } from '~/components/ui/glass-button';
import { Crown, User, Check, AlertCircle } from 'lucide-react';

export default function MembershipAdminPage() {
  const { user } = useUser();
  const [userId, setUserId] = useState('');
  const [tier, setTier] = useState<'basic' | 'mycountry_premium'>('mycountry_premium');
  const [message, setMessage] = useState('');
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
      setMessage('❌ Please enter a User ID');
      return;
    }

    setIsLoading(true);
    setMessage('');

    updateMembershipMutation.mutate({
      userId: userId.trim(),
      tier,
    });
  };

  const upgradeSelf = () => {
    if (user?.id) {
      setUserId(user.id);
      setTier('mycountry_premium');
    }
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-2xl">
      <div className="glass-panel p-8 space-y-6">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <Crown className="w-12 h-12 text-yellow-400" />
          </div>
          <h1 className="text-3xl font-bold text-white">
            Membership Tier Management
          </h1>
          <p className="text-white/80">
            Update user membership tiers for testing premium features
          </p>
        </div>

        {/* Quick Actions */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-white">Quick Actions</h2>

          <div className="flex flex-col sm:flex-row gap-3">
            <GlassButton
              variant="primary"
              onClick={upgradeSelf}
              className="flex-1"
            >
              <Crown className="w-4 h-4 mr-2" />
              Upgrade Myself to Premium
            </GlassButton>

            <GlassButton
              variant="secondary"
              onClick={() => {
                if (user?.id) {
                  setUserId(user.id);
                  setTier('basic');
                }
              }}
              className="flex-1"
            >
              <User className="w-4 h-4 mr-2" />
              Downgrade Myself to Basic
            </GlassButton>
          </div>
        </div>

        {/* Manual Update */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-white">Manual Update</h2>

          <div className="space-y-4">
            <div>
              <label htmlFor="userId" className="block text-sm font-medium text-white/90 mb-2">
                User ID (Clerk User ID)
              </label>
              <input
                id="userId"
                type="text"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder="user_..."
                className="w-full px-4 py-3 bg-black/20 border border-white/20 rounded-lg text-white placeholder-white/50 focus:border-blue-400 focus:outline-none"
              />
              {user?.id && (
                <p className="text-sm text-white/60 mt-1">
                  Your User ID: {user.id}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="tier" className="block text-sm font-medium text-white/90 mb-2">
                Membership Tier
              </label>
              <select
                id="tier"
                value={tier}
                onChange={(e) => setTier(e.target.value as 'basic' | 'mycountry_premium')}
                className="w-full px-4 py-3 bg-black/20 border border-white/20 rounded-lg text-white focus:border-blue-400 focus:outline-none"
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
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Updating...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Update Membership Tier
                </>
              )}
            </GlassButton>
          </div>
        </div>

        {/* Status Message */}
        {message && (
          <div className={`p-4 rounded-lg border ${
            message.includes('✅')
              ? 'bg-green-500/10 border-green-400/30 text-green-200'
              : 'bg-red-500/10 border-red-400/30 text-red-200'
          }`}>
            <div className="flex items-center">
              {message.includes('✅') ? (
                <Check className="w-5 h-5 mr-2" />
              ) : (
                <AlertCircle className="w-5 h-5 mr-2" />
              )}
              {message}
            </div>
          </div>
        )}

        {/* Info */}
        <div className="bg-blue-500/10 border border-blue-400/30 rounded-lg p-4">
          <h3 className="font-semibold text-blue-200 mb-2">Premium Features</h3>
          <ul className="text-blue-200/80 text-sm space-y-1">
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