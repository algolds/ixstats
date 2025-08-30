"use client";

import React, { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { motion } from "framer-motion";
import { 
  MessageSquare, 
  Users, 
  Settings,
  ArrowLeft,
  Send,
  Home,
  Globe
} from "lucide-react";
import Link from "next/link";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { ThinkpagesSocialPlatform } from "~/components/thinkpages/ThinkpagesSocialPlatform";
import { EnhancedAccountManager } from "~/components/thinkpages/EnhancedAccountManager";
import { AccountCreationModal } from "~/components/thinkpages/AccountCreationModal";
import { AccountSettingsModal } from "~/components/thinkpages/AccountSettingsModal";
import dynamic from 'next/dynamic';

// Dynamically import components to prevent tRPC queries from running until needed
const ThinktankGroups = dynamic(
  () => import("~/components/thinkpages/ThinktankGroups").then((mod) => ({ default: mod.ThinktankGroups })),
  { 
    loading: () => (
      <div className="space-y-6">
        <Card className="glass-hierarchy-parent">
          <CardContent className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <h3 className="text-lg font-semibold mb-2">Loading ThinkTanks...</h3>
            <p className="text-muted-foreground">Please wait while we set up your groups</p>
          </CardContent>
        </Card>
      </div>
    ),
    ssr: false 
  }
);

const ThinkshareMessages = dynamic(
  () => import("~/components/thinkshare/ThinkshareMessages").then((mod) => ({ default: mod.ThinkshareMessages })),
  { 
    loading: () => (
      <div className="space-y-6">
        <Card className="glass-hierarchy-parent">
          <CardContent className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <h3 className="text-lg font-semibold mb-2">Loading Messages...</h3>
            <p className="text-muted-foreground">Please wait while we set up your conversations</p>
          </CardContent>
        </Card>
      </div>
    ),
    ssr: false 
  }
);
import { createUrl } from "~/lib/url-utils";
import { api } from "~/trpc/react";

export default function ThinkPagesMainPage() {
  const { user } = useUser();
  const [activeView, setActiveView] = useState<'feed' | 'thinktanks' | 'messages'>('feed');
  const [selectedAccount, setSelectedAccount] = useState<any>(null);
  const [showAccountCreation, setShowAccountCreation] = useState(false);
  const [showAccountSettings, setShowAccountSettings] = useState(false);
  const [settingsAccount, setSettingsAccount] = useState<any>(null);

  // Handle URL parameters for auto-selecting view and conversation
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const viewParam = urlParams.get('view');
      const conversationParam = urlParams.get('conversation');
      
      if (viewParam === 'messages') {
        setActiveView('messages');
      }
      
      // The conversation parameter will be handled by the ThinkshareMessages component
    }
  }, []);

  // Get user profile and country data
  const { data: userProfile } = api.users.getProfile.useQuery(
    { userId: user?.id || '' },
    { enabled: !!user?.id }
  );

  const { data: countryData } = api.countries.getByIdAtTime.useQuery(
    { id: userProfile?.countryId || '' },
    { enabled: !!userProfile?.countryId }
  );

  const { data: accounts, refetch: refetchAccounts } = api.thinkpages.getAccountsByCountry.useQuery(
    { countryId: userProfile?.countryId || 'INVALID' },
    { 
      enabled: false, // NEVER auto-enable
      retry: 0,
      refetchOnWindowFocus: false
    }
  );

  // More comprehensive validation
  const isDataReady = user && userProfile && countryData && 
                     userProfile.countryId && userProfile.countryId.trim() !== '' &&
                     countryData.id && countryData.id.trim() !== '' &&
                     countryData.name && countryData.name.trim() !== '';

  // Manual control for accounts query
  React.useEffect(() => {
    if (isDataReady && userProfile.countryId && userProfile.countryId.trim() !== '') {
      refetchAccounts();
    }
  }, [isDataReady, userProfile?.countryId, refetchAccounts]);

  // Account management handlers
  const handleAccountSelect = (account: any) => {
    setSelectedAccount(account);
  };

  const handleAccountSettings = (account: any) => {
    setSettingsAccount(account);
    setShowAccountSettings(true);
  };

  const handleCreateAccount = () => {
    setShowAccountCreation(true);
  };

  const handleAccountCreated = () => {
    setShowAccountCreation(false);
    refetchAccounts();
  };

  const handleAccountUpdated = () => {
    setShowAccountSettings(false);
    setSettingsAccount(null);
    refetchAccounts();
  };

  if (!isDataReady) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="glass-modal max-w-md w-full text-center p-8">
          <MessageSquare className="h-16 w-16 mx-auto mb-4 text-blue-500" />
          <h2 className="text-2xl font-bold mb-4">Welcome to Thinkpages</h2>
          <p className="text-muted-foreground mb-6">
            Please complete your profile setup to access the platform.
          </p>
          <Link href={createUrl("/setup")}>
            <Button className="w-full">
              Complete Setup
            </Button>
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-6">
        {/* Authentic Thinkpages Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          {/* Top Navigation */}
          <div className="flex items-center justify-between mb-6 p-4 glass-hierarchy-parent rounded-xl">
            <div className="flex items-center gap-6">
              <Link href={createUrl("/dashboard")}>
                <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Dashboard
                </Button>
              </Link>
              
              <div className="h-5 w-px bg-border" />
              
              {/* Authentic Thinkpages Logo */}
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 bg-gradient-to-br from-[#0050a1] to-[#fcc309] rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-lg">T</span>
                </div>
                <div>
                  <h1 className="text-xl font-bold bg-gradient-to-r from-[#0050a1] to-[#fcc309] bg-clip-text text-transparent">Thinkpages</h1>
                  <p className="text-xs text-muted-foreground">
                    Where Minds Meet • Since 2002
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Badge variant="outline" className="text-xs">
                {countryData.name}
              </Badge>
              <Button variant="ghost" size="sm">
                <Settings className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Main Navigation */}
          <div className="flex items-center gap-4 p-2 glass-hierarchy-child rounded-xl">
            <Button
              variant={activeView === 'feed' ? 'default' : 'ghost'}
              onClick={() => setActiveView('feed')}
              className="flex items-center gap-2"
            >
              <Home className="h-4 w-4" />
               Feed
            </Button>
            <Button
              variant={activeView === 'thinktanks' ? 'default' : 'ghost'}
              onClick={() => setActiveView('thinktanks')}
              className="flex items-center gap-2"
            >
              <Globe className="h-4 w-4" />
              Groups
            </Button>
            <Button
              variant={activeView === 'messages' ? 'default' : 'ghost'}
              onClick={() => setActiveView('messages')}
              className="flex items-center gap-2"
            >
              <Send className="h-4 w-4" />
              Thinkshare
            </Button>
            
          </div>
          
        </motion.div>
        {/* Main Content with Account Manager Sidebar */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`grid grid-cols-1 ${activeView === 'feed' ? 'lg:grid-cols-4' : 'lg:grid-cols-1'} gap-6`}
        >
          {/* Left Sidebar - Account Manager */}
          {activeView === 'feed' && (
            <div className="lg:col-span-1 space-y-4">
              <EnhancedAccountManager
                countryId={countryData.id}
                accounts={accounts || []}
                selectedAccount={selectedAccount}
                onAccountSelect={handleAccountSelect}
                onAccountSettings={handleAccountSettings}
                onCreateAccount={handleCreateAccount}
                isOwner={true}
              />
            </div>
          )}

          {/* Main Content Area */}
          <div className={activeView === 'feed' ? "lg:col-span-3" : "lg:col-span-4"}>
            {activeView === 'feed' && (
              <ThinkpagesSocialPlatform
                countryId={countryData.id}
                countryName={countryData.name}
                isOwner={true}
              />
            )}

            {activeView === 'thinktanks' && isDataReady && countryData?.id && countryData?.name && (
              <ThinktankGroups
                countryId={countryData.id}
                countryName={countryData.name}
                userAccounts={accounts || []}
              />
            )}

            {activeView === 'messages' && isDataReady && countryData?.id && countryData?.name && (
              <ThinkshareMessages
                countryId={countryData.id}
                countryName={countryData.name}
                userAccounts={accounts || []}
              />
            )}
          </div>
        </motion.div>

        {/* Account Management Modals */}
        {showAccountCreation && (
          <AccountCreationModal
            countryId={countryData.id}
            countryName={countryData.name}
            existingAccountCount={accounts?.length || 0}
            isOpen={showAccountCreation}
            onClose={() => setShowAccountCreation(false)}
            onAccountCreated={handleAccountCreated}
          />
        )}

        {showAccountSettings && settingsAccount && (
          <AccountSettingsModal
            account={settingsAccount}
            isOpen={showAccountSettings}
            onClose={() => setShowAccountSettings(false)}
            onAccountUpdate={handleAccountUpdated}
          />
        )}

        {/* Authentic Footer */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-16 text-center border-t pt-8"
        >
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="h-6 w-6 bg-gradient-to-br from-[#0050a1] to-[#fcc309] rounded flex items-center justify-center">
              <span className="text-white font-bold text-xs">T</span>
            </div>
            <span className="font-semibold bg-gradient-to-r from-[#0050a1] to-[#fcc309] bg-clip-text text-transparent">Thinkpages</span>
          </div>
          
          <div className="space-y-2 text-xs text-muted-foreground">
            <p>© 2002-2040 <a href="https://ixwiki.com/wiki/Valtari">Valtari Technologies, Inc.</a></p>
            <p>Made with ♡ from Hollona and Diorisia </p>
            <p>The world’s most trusted platform for sharing ideas, connecting minds, and shaping the conversations that define the future.</p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}