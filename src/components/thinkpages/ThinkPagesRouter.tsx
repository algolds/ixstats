"use client";

import { useState, useCallback, useEffect } from "react";
import { usePathname } from "next/navigation";
import { MessageSquare, Send } from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Switch } from "~/components/ui/switch";
import { Label } from "~/components/ui/label";
import dynamic from "next/dynamic";
import { useUser } from "~/context/auth-context";
import { api } from "~/trpc/react";
import { createUrl } from "~/lib/url-utils";

import { ThinkpagesSocialPlatform } from "./ThinkpagesSocialPlatform";
import { AccountCreationModal } from "./AccountCreationModal";
import { AccountSettingsModal } from "./AccountSettingsModal";
import { ThinkPagesSidebarLayout } from "./ThinkPagesSidebarLayout";
import { ThinkPagesHeader } from "./ThinkPagesHeader";
import { ThinkPagesFooter } from "./ThinkPagesFooter";
import { getSectionFromPathname, type ThinkPagesSection } from "./ThinkPagesSidebarNav";
import { withBasePath } from "~/lib/base-path";

// Dynamically import heavy components to prevent tRPC queries from running until needed
const ThinktankGroups = dynamic(
  () => import("./ThinktankGroups").then((mod) => ({ default: mod.ThinktankGroups })),
  {
    loading: () => (
      <div className="space-y-6">
        <Card className="glass-hierarchy-parent">
          <CardContent className="p-8 text-center">
            <div className="border-primary mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-b-2" />
            <h3 className="mb-2 text-lg font-semibold">Loading ThinkTanks...</h3>
            <p className="text-muted-foreground">Please wait while we set up your groups</p>
          </CardContent>
        </Card>
      </div>
    ),
    ssr: false,
  },
);

const ThinkshareMessages = dynamic(
  () => import("~/components/thinkshare/ThinkshareMessages").then((mod) => ({ default: mod.ThinkshareMessages })),
  {
    loading: () => (
      <div className="space-y-6">
        <Card className="glass-hierarchy-parent">
          <CardContent className="p-8 text-center">
            <div className="border-primary mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-b-2" />
            <h3 className="mb-2 text-lg font-semibold">Loading Messages...</h3>
            <p className="text-muted-foreground">Please wait while we set up your conversations</p>
          </CardContent>
        </Card>
      </div>
    ),
    ssr: false,
  },
);

const SECTION_TITLES: Record<ThinkPagesSection, string> = {
  feed: "ThinkPages Feed",
  thinktanks: "ThinkTanks",
  messages: "ThinkShare",
};

function sectionToHref(section: ThinkPagesSection): string {
  const path = section === "feed" ? "/thinkpages"
    : section === "messages" ? "/thinkpages/thinkshare"
    : `/thinkpages/${section}`;
  return withBasePath(path);
}

export function ThinkPagesRouter() {
  const pathname = usePathname();

  const [activeSection, setActiveSection] = useState<ThinkPagesSection>(
    () => getSectionFromPathname(pathname),
  );

  // Account management state
  const [selectedAccount, setSelectedAccount] = useState<any>(null);
  const [showAccountCreation, setShowAccountCreation] = useState(false);
  const [showAccountSettings, setShowAccountSettings] = useState(false);
  const [settingsAccount, setSettingsAccount] = useState<any>(null);
  const [showGlobalSettings, setShowGlobalSettings] = useState(false);

  // Navigation handler — instant section switching via pushState
  const handleNavigate = useCallback((section: ThinkPagesSection) => {
    if (section === activeSection) return;
    setActiveSection(section);
    window.history.pushState(null, "", sectionToHref(section));
    document.title = `${SECTION_TITLES[section]} - ThinkPages`;
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [activeSection]);

  // Handle browser back/forward
  useEffect(() => {
    const onPopState = () => {
      const newSection = getSectionFromPathname(window.location.pathname);
      setActiveSection(newSection);
      window.scrollTo({ top: 0, behavior: "instant" });
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  // Handle legacy ?view= query params and ?panel= params
  useEffect(() => {
    if (typeof window === "undefined") return;
    const urlParams = new URLSearchParams(window.location.search);
    const viewParam = urlParams.get("view");
    const panelParam = urlParams.get("panel");

    if (viewParam === "thinktanks" || viewParam === "messages" || viewParam === "feed") {
      setActiveSection(viewParam);
      // Clean up query params — use path-based navigation going forward
      window.history.replaceState(null, "", sectionToHref(viewParam));
    }

    if (panelParam === "settings") {
      setShowGlobalSettings(true);
    }
  }, []);

  // Set page title on section change
  useEffect(() => {
    document.title = `${SECTION_TITLES[activeSection]} - ThinkPages`;
  }, [activeSection]);

  // Data fetching
  const { user } = useUser();
  const isUserAuthenticated = !!user?.id;

  const { data: userProfile } = api.users.getProfile.useQuery(
    undefined,
    { enabled: isUserAuthenticated },
  );

  const { data: countryData } = api.countries.getByIdAtTime.useQuery(
    { id: userProfile?.countryId || "" },
    {
      enabled: !!userProfile?.countryId && userProfile.countryId.trim() !== "",
      retry: false,
    },
  );

  const { data: accountsData } = api.thinkpages.getAccountsByCountry.useQuery(
    { countryId: userProfile?.countryId || "" },
    { enabled: !!userProfile?.countryId },
  );

  const accounts = accountsData || [];

  // Auto-select first account
  useEffect(() => {
    if (!selectedAccount && accounts.length > 0) {
      setSelectedAccount(accounts[0]);
    }
  }, [accounts, selectedAccount]);

  const isCountryDataReady =
    userProfile &&
    countryData &&
    userProfile.countryId &&
    userProfile.countryId.trim() !== "" &&
    countryData.id &&
    countryData.id.trim() !== "" &&
    countryData.name &&
    countryData.name.trim() !== "";

  // Account management handlers
  const handleAccountSelect = (account: any) => setSelectedAccount(account);
  const handleAccountSettings = (account: any) => {
    setSettingsAccount(account);
    setShowAccountSettings(true);
  };
  const handleCreateAccount = () => setShowAccountCreation(true);
  const handleAccountCreated = () => setShowAccountCreation(false);
  const handleAccountUpdated = () => {
    setShowAccountSettings(false);
    setSettingsAccount(null);
  };

  return (
    <div className="bg-background min-h-screen">
      <ThinkPagesSidebarLayout
        activeSection={activeSection}
        onNavigate={handleNavigate}
        countryId={userProfile?.countryId}
        isAuthenticated={isUserAuthenticated}
        onOpenSettings={() => setShowGlobalSettings(true)}
        heroSection={
          <ThinkPagesHeader
            countryName={countryData?.name}
            isAuthenticated={isUserAuthenticated}
            onOpenSettings={() => setShowGlobalSettings(true)}
          />
        }
      >
        {/* Section Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeSection}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
          >
            {/* ── Feed ── */}
            {activeSection === "feed" && isUserAuthenticated && isCountryDataReady && (
              <ThinkpagesSocialPlatform
                countryId={countryData.id}
                countryName={countryData.name}
                isOwner={true}
                selectedAccount={selectedAccount}
                accounts={accounts}
                onAccountSelect={handleAccountSelect}
                onAccountSettings={handleAccountSettings}
                onCreateAccount={handleCreateAccount}
              />
            )}

            {activeSection === "feed" && isUserAuthenticated && !isCountryDataReady && (
              <Card className="glass-hierarchy-parent">
                <CardContent className="p-8 text-center">
                  <MessageSquare className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
                  <h3 className="mb-2 text-lg font-semibold">Country Setup Required</h3>
                  <p className="text-muted-foreground mb-4">
                    To access the social feed, please complete your country setup first.
                  </p>
                  <Link href={createUrl("/setup")}>
                    <Button>Complete Setup</Button>
                  </Link>
                </CardContent>
              </Card>
            )}

            {activeSection === "feed" && !isUserAuthenticated && (
              <div className="space-y-6">
                <Card className="glass-hierarchy-parent">
                  <CardContent className="flex items-start gap-4 p-6">
                    <MessageSquare className="mt-1 h-8 w-8 flex-shrink-0 text-blue-500" />
                    <div className="flex-1">
                      <h3 className="mb-2 text-lg font-semibold">Welcome to Thinkpages</h3>
                      <p className="text-muted-foreground mb-3">
                        You&apos;re viewing Thinkpages in read-only mode. To participate in discussions,
                        create posts, and join groups, please sign in or create an account.
                      </p>
                      <div className="flex flex-col gap-3 sm:flex-row">
                        <Link href={createUrl("/setup")}>
                          <Button size="sm">Sign In / Sign Up</Button>
                        </Link>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleNavigate("thinktanks")}
                        >
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

            {/* ── ThinkTanks ── */}
            {activeSection === "thinktanks" && (
              <ThinktankGroups
                userId={user?.id || null}
                userAccounts={accounts}
                viewOnly={!isUserAuthenticated}
              />
            )}

            {/* ── ThinkShare ── */}
            {activeSection === "messages" && isUserAuthenticated && (
              <ThinkshareMessages userId={user!.id} userAccounts={accounts} />
            )}

            {activeSection === "messages" && !isUserAuthenticated && (
              <Card className="glass-hierarchy-parent">
                <CardContent className="p-8 text-center">
                  <Send className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
                  <h3 className="mb-2 text-lg font-semibold">Sign In Required</h3>
                  <p className="text-muted-foreground mb-4">
                    Messages are private. Please sign in to access your conversations.
                  </p>
                  <Link href={createUrl("/setup")}>
                    <Button>Sign In / Sign Up</Button>
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
            existingAccountCount={accounts.length}
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

        {/* Footer */}
        <ThinkPagesFooter />

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
                    <span className="text-muted-foreground text-xs">
                      Let others see when you&apos;re active
                    </span>
                  </Label>
                  <Switch id="show-online" />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="discoverable" className="flex flex-col gap-1">
                    <span>Discoverable profile</span>
                    <span className="text-muted-foreground text-xs">Allow others to find you</span>
                  </Label>
                  <Switch id="discoverable" defaultChecked />
                </div>
              </div>

              <div className="space-y-4 border-t pt-4">
                <h3 className="text-sm font-semibold">Notifications</h3>
                <div className="flex items-center justify-between">
                  <Label htmlFor="post-notif" className="flex flex-col gap-1">
                    <span>Post reactions</span>
                    <span className="text-muted-foreground text-xs">
                      Get notified when someone reacts
                    </span>
                  </Label>
                  <Switch id="post-notif" defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="mention-notif" className="flex flex-col gap-1">
                    <span>Mentions & replies</span>
                    <span className="text-muted-foreground text-xs">
                      Get notified when mentioned
                    </span>
                  </Label>
                  <Switch id="mention-notif" defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="group-notif" className="flex flex-col gap-1">
                    <span>ThinkTank activity</span>
                    <span className="text-muted-foreground text-xs">
                      Group messages and updates
                    </span>
                  </Label>
                  <Switch id="group-notif" defaultChecked />
                </div>
              </div>

              <div className="space-y-4 border-t pt-4">
                <h3 className="text-sm font-semibold">About ThinkPages</h3>
                <div className="text-muted-foreground space-y-2 text-xs">
                  <p>
                    <strong>Account Limit:</strong> {accounts.length}/25 accounts
                  </p>
                  <p>
                    <strong>Platform:</strong> ThinkPages v1.0
                  </p>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </ThinkPagesSidebarLayout>
    </div>
  );
}
