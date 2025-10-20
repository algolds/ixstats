"use client";

import React, { useState, useEffect } from "react";
import { usePageTitle } from "~/hooks/usePageTitle";
import { useUser } from "~/context/auth-context";
import { motion, AnimatePresence } from "framer-motion";
import { 
  MessageSquare, 
  Users, 
  Settings,
  ArrowLeft,
  Send,
  ChevronDown
} from "lucide-react";
import Link from "next/link";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { Switch } from "~/components/ui/switch";
import { Label } from "~/components/ui/label";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "~/components/ui/dropdown-menu";
import { ThinkpagesSocialPlatform } from "~/components/thinkpages/ThinkpagesSocialPlatform";
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

const WORKSPACE_LINKS = [
  {
    key: 'feed',
    label: 'ThinkPages',
    description: 'The global forum',
    icon: MessageSquare
  },
  {
    key: 'thinktanks',
    label: 'ThinkTanks',
    description: 'Collaborative groups to strategize and plan',
    icon: Users
  },
  {
    key: 'messages',
    label: 'ThinkShare',
    description: 'Private channels for confidential diplomatic communications and strategic coordination.',
    icon: Send
  }
] as const;

export default function ThinkPagesMainPage() {
  usePageTitle({ title: "ThinkPages" });
  
  const { user } = useUser();
  const [activeView, setActiveView] = useState<'feed' | 'thinktanks' | 'messages'>('feed');
  const [selectedAccount, setSelectedAccount] = useState<any>(null);
  const [showAccountCreation, setShowAccountCreation] = useState(false);
  const [showAccountSettings, setShowAccountSettings] = useState(false);
  const [settingsAccount, setSettingsAccount] = useState<any>(null);
  const [showGlobalSettings, setShowGlobalSettings] = useState(false);

  // Handle URL parameters for auto-selecting view and contextual panels
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const urlParams = new URLSearchParams(window.location.search);
    const viewParam = urlParams.get('view');
    const panelParam = urlParams.get('panel');

    if (viewParam === 'thinktanks' || viewParam === 'messages' || viewParam === 'feed') {
      setActiveView(viewParam);
    }

    if (panelParam === 'account-manager') {
      setActiveView('feed');
    }

    if (panelParam === 'settings') {
      setShowGlobalSettings(true);
    }
    // Conversation-specific handling remains within ThinkshareMessages
  }, []);

  // Persist view selection in the URL for deep linking
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    url.searchParams.set('view', activeView);
    url.searchParams.delete('panel');
    window.history.replaceState({}, '', url.toString());
  }, [activeView]);


  // Get user profile and country data
  const { data: userProfile } = api.users.getProfile.useQuery(
    undefined,
    { enabled: !!user?.id }
  );

  const { data: countryData } = api.countries.getByIdAtTime.useQuery(
    { id: userProfile?.countryId || '' },
    { enabled: !!userProfile?.countryId }
  );

  // Fetch ThinkPages accounts for the feed (still needed for feed posting)
  const { data: accountsData } = api.thinkpages.getAccountsByCountry.useQuery(
    { countryId: userProfile?.countryId || '' },
    { enabled: !!userProfile?.countryId }
  );

  const accounts = accountsData || [];

  // Allow anonymous access for view-only mode
  const isUserAuthenticated = user && user.id;

  // ThinkTanks and ThinkShare work globally, only Feed requires country setup
  const isCountryDataReady = userProfile && countryData &&
                           userProfile.countryId && userProfile.countryId.trim() !== '' &&
                           countryData.id && countryData.id.trim() !== '' &&
                           countryData.name && countryData.name.trim() !== '';


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
  };

  const handleAccountUpdated = () => {
    setShowAccountSettings(false);
    setSettingsAccount(null);
  };

  // No authentication gate - allow anonymous access

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
                  <DropdownMenu>
                    <DropdownMenuTrigger className="h-auto p-0 text-xs text-muted-foreground hover:text-foreground bg-transparent border-none cursor-pointer flex items-center gap-1">
                      {WORKSPACE_LINKS.find(link => link.key === activeView)?.label || 'ThinkPages'} • The Global Forum
                      <ChevronDown className="h-3 w-3 ml-1" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      {WORKSPACE_LINKS.map((link) => {
                        const Icon = link.icon;
                        return (
                          <DropdownMenuItem
                            key={link.key}
                            onClick={() => setActiveView(link.key as 'feed' | 'thinktanks' | 'messages')}
                            className="flex items-center gap-2"
                          >
                            <Icon className="h-4 w-4" />
                            <div>
                              <div className="font-medium">{link.label}</div>
                              <div className="text-xs text-muted-foreground">{link.description}</div>
                            </div>
                          </DropdownMenuItem>
                        );
                      })}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {isUserAuthenticated ? (
                <>
                  {countryData?.name && (
                    <Badge variant="outline" className="text-xs">
                      {countryData.name}
                    </Badge>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => setShowGlobalSettings(true)}>
                    <Settings className="h-4 w-4" />
                  </Button>
                </>
              ) : (
                <div className="flex items-center gap-3">
                  <Badge variant="secondary" className="text-xs">
                    👁️ View Only
                  </Badge>
                  <Link href={createUrl("/setup")}>
                    <Button size="sm">
                      Sign In / Sign Up
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          </div>


        </motion.div>


        <AnimatePresence mode="wait">
          <motion.div
            key={activeView}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
          >
              {activeView === 'feed' && isUserAuthenticated && isCountryDataReady && (
                <ThinkpagesSocialPlatform
                  countryId={countryData.id}
                  countryName={countryData.name}
                  isOwner={true}
                  selectedAccount={selectedAccount}
                  accounts={accounts || []}
                  onAccountSelect={handleAccountSelect}
                  onAccountSettings={handleAccountSettings}
                  onCreateAccount={handleCreateAccount}
                />
              )}

              {activeView === 'feed' && isUserAuthenticated && !isCountryDataReady && (
                <Card className="glass-hierarchy-parent">
                  <CardContent className="p-8 text-center">
                    <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Country Setup Required</h3>
                    <p className="text-muted-foreground mb-4">
                      To access the social feed, please complete your country setup first.
                    </p>
                    <Link href={createUrl("/setup")}>
                      <Button>
                        Complete Setup
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              )}

              {activeView === 'feed' && !isUserAuthenticated && (
                <div className="space-y-6">
                  <Card className="glass-hierarchy-parent">
                    <CardContent className="p-6 flex items-start gap-4">
                      <MessageSquare className="h-8 w-8 text-blue-500 flex-shrink-0 mt-1" />
                      <div className="flex-1">
                        <h3 className="font-semibold text-lg mb-2">Welcome to Thinkpages</h3>
                        <p className="text-muted-foreground mb-3">
                          You're viewing Thinkpages in read-only mode. To participate in discussions, create posts, and join groups, please sign in or create an account.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-3">
                          <Link href={createUrl("/setup")}>
                            <Button size="sm">
                              Sign In / Sign Up
                            </Button>
                          </Link>
                          <Button variant="outline" size="sm" onClick={() => setActiveView('thinktanks')}>
                            Browse Groups
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <ThinkpagesSocialPlatform
                    countryId="global"
                    countryName="Global Community"
                    isOwner={false}
                  />
                </div>
              )}

              {activeView === 'thinktanks' && (
                <ThinktankGroups
                  userId={user?.id || null}
                  userAccounts={accounts || []}
                  viewOnly={!isUserAuthenticated}
                />
              )}

              {activeView === 'messages' && isUserAuthenticated && (
                <ThinkshareMessages
                  userId={user.id}
                  userAccounts={accounts || []}
                />
              )}

              {activeView === 'messages' && !isUserAuthenticated && (
                <Card className="glass-hierarchy-parent">
                  <CardContent className="p-8 text-center">
                    <Send className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Sign In Required</h3>
                    <p className="text-muted-foreground mb-4">
                      Messages are private. Please sign in to access your conversations.
                    </p>
                    <Link href={createUrl("/setup")}>
                      <Button>
                        Sign In / Sign Up
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              )}
          </motion.div>
        </AnimatePresence>

        {/* Account Management Modals */}
        {showAccountCreation && isCountryDataReady && (
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
            <p>Where nations converge, ideas flourish, and the future of global discourse takes shape.</p>
          </div>
        </motion.div>

        {/* Global ThinkPages Settings Dialog */}
        <Dialog open={showGlobalSettings} onOpenChange={setShowGlobalSettings}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>ThinkPages Settings</DialogTitle>
              <DialogDescription>
                Manage your global ThinkPages preferences and privacy settings
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 py-4">
              <div className="space-y-4">
                <h3 className="text-sm font-semibold">Privacy & Visibility</h3>
                <div className="flex items-center justify-between">
                  <Label htmlFor="show-online" className="flex flex-col gap-1">
                    <span>Show online status</span>
                    <span className="text-xs text-muted-foreground">Let others see when you're active</span>
                  </Label>
                  <Switch id="show-online" />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="discoverable" className="flex flex-col gap-1">
                    <span>Discoverable profile</span>
                    <span className="text-xs text-muted-foreground">Allow others to find you</span>
                  </Label>
                  <Switch id="discoverable" defaultChecked />
                </div>
              </div>

              <div className="space-y-4 border-t pt-4">
                <h3 className="text-sm font-semibold">Notifications</h3>
                <div className="flex items-center justify-between">
                  <Label htmlFor="post-notif" className="flex flex-col gap-1">
                    <span>Post reactions</span>
                    <span className="text-xs text-muted-foreground">Get notified when someone reacts</span>
                  </Label>
                  <Switch id="post-notif" defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="mention-notif" className="flex flex-col gap-1">
                    <span>Mentions & replies</span>
                    <span className="text-xs text-muted-foreground">Get notified when mentioned</span>
                  </Label>
                  <Switch id="mention-notif" defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="group-notif" className="flex flex-col gap-1">
                    <span>ThinkTank activity</span>
                    <span className="text-xs text-muted-foreground">Group messages and updates</span>
                  </Label>
                  <Switch id="group-notif" defaultChecked />
                </div>
              </div>

              <div className="space-y-4 border-t pt-4">
                <h3 className="text-sm font-semibold">About ThinkPages</h3>
                <div className="text-xs text-muted-foreground space-y-2">
                  <p><strong>Account Limit:</strong> {accounts.length}/25 accounts</p>
                  <p><strong>Platform:</strong> ThinkPages v1.0</p>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
