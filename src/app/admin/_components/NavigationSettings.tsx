"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";
import {
  SystemRestart as Loader2,
  Navigator as Navigation,
  Eye,
  EyeClosed as EyeOff,
  FloppyDisk as Save,
  Check,
  Shield,
} from "iconoir-react";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";

export function NavigationSettings() {
  const notify = useNotify();
  const [localSettings, setLocalSettings] = useState({
    showWikiTab: true,
    showCardsTab: true,
    showLabsTab: true,
    showIntelligenceTab: false,
    showDefenseTab: false,
    showMapsTab: true,
    showForumTab: true,
    showHelpTab: true,
  });
  const [isSaving, setIsSaving] = useState(false);

  // Query to get current navigation settings
  const {
    data: navigationSettings,
    isLoading,
    refetch,
  } = api.admin.getNavigationSettings.useQuery();

  // Update local settings when data arrives
  useEffect(() => {
    if (navigationSettings) {
      setLocalSettings((prev) => ({
        ...prev,
        ...navigationSettings,
      }));
    }
  }, [navigationSettings]);

  // Mutation to update navigation settings
  const updateSettingsMutation = api.admin.updateNavigationSettings.useMutation({
    onSuccess: () => {
      notify.success("Navigation settings updated successfully");
      refetch();
      setIsSaving(false);
    },
    onError: (error) => {
      notify.error(`Failed to update settings: ${error.message}`);
      setIsSaving(false);
    },
  });

  const handleSave = async () => {
    setIsSaving(true);
    updateSettingsMutation.mutate(localSettings);
  };

  const handleToggle = (setting: keyof typeof localSettings, value: boolean) => {
    setLocalSettings((prev) => ({
      ...prev,
      [setting]: value,
    }));
  };

  const hasChanges =
    navigationSettings &&
    (navigationSettings.showWikiTab !== localSettings.showWikiTab ||
      navigationSettings.showCardsTab !== localSettings.showCardsTab ||
      navigationSettings.showLabsTab !== localSettings.showLabsTab ||
      navigationSettings.showIntelligenceTab !== localSettings.showIntelligenceTab ||
      navigationSettings.showDefenseTab !== localSettings.showDefenseTab ||
      navigationSettings.showMapsTab !== localSettings.showMapsTab ||
      navigationSettings.showForumTab !== localSettings.showForumTab ||
      navigationSettings.showHelpTab !== localSettings.showHelpTab);

  if (isLoading) {
    return (
      <Card className="flex flex-col gap-6 py-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Navigation className="h-5 w-5" />
            Navigation settings
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="text-label-secondary h-8 w-8 animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col gap-6 py-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Navigation className="h-5 w-5" />
          Navigation settings
        </CardTitle>
        <p className="text-label-secondary text-body">
          Control which navigation tabs are visible to users. These tabs can be hidden to simplify
          the navigation bar.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Wiki Tab Setting */}
        <div className="bg-surface border-separator rounded-control flex items-center justify-between border p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-control border-blue/20 bg-blue/10 border p-2">
              {localSettings.showWikiTab ? (
                <Eye className="text-blue h-4 w-4" />
              ) : (
                <EyeOff className="text-label-secondary h-4 w-4" />
              )}
            </div>
            <div>
              <Label htmlFor="wiki-tab" className="text-body font-medium">
                Wiki tab
              </Label>
              <p className="text-label-secondary text-footnote">
                Show/hide the Wiki navigation tab
              </p>
            </div>
          </div>
          <Switch
            id="wiki-tab"
            checked={localSettings.showWikiTab}
            onCheckedChange={(checked) => handleToggle("showWikiTab", checked)}
          />
        </div>

        {/* Cards Tab Setting */}
        <div className="bg-surface border-separator rounded-control flex items-center justify-between border p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-control border-teal/20 bg-teal/10 border p-2">
              {localSettings.showCardsTab ? (
                <Eye className="text-teal h-4 w-4" />
              ) : (
                <EyeOff className="text-label-secondary h-4 w-4" />
              )}
            </div>
            <div>
              <Label htmlFor="cards-tab" className="text-body font-medium">
                Cards tab
              </Label>
              <p className="text-label-secondary text-footnote">
                Show/hide the Cards navigation tab
              </p>
            </div>
          </div>
          <Switch
            id="cards-tab"
            checked={localSettings.showCardsTab}
            onCheckedChange={(checked) => handleToggle("showCardsTab", checked)}
          />
        </div>

        {/* Labs Tab Setting */}
        <div className="bg-surface border-separator rounded-control flex items-center justify-between border p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-control border-purple/20 bg-purple/10 border p-2">
              {localSettings.showLabsTab ? (
                <Eye className="text-purple h-4 w-4" />
              ) : (
                <EyeOff className="text-label-secondary h-4 w-4" />
              )}
            </div>
            <div>
              <Label htmlFor="labs-tab" className="text-body font-medium">
                Labs tab
              </Label>
              <p className="text-label-secondary text-footnote">
                Show/hide the Labs navigation tab and dropdown
              </p>
            </div>
          </div>
          <Switch
            id="labs-tab"
            checked={localSettings.showLabsTab}
            onCheckedChange={(checked) => handleToggle("showLabsTab", checked)}
          />
        </div>

        {/* Intelligence Tab Setting */}
        <div className="bg-surface border-separator rounded-control flex items-center justify-between border p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-control border-green/20 bg-green/10 border p-2">
              {localSettings.showIntelligenceTab ? (
                <Eye className="text-green h-4 w-4" />
              ) : (
                <EyeOff className="text-label-secondary h-4 w-4" />
              )}
            </div>
            <div>
              <Label
                htmlFor="intelligence-tab"
                className="text-body flex items-center gap-1 font-medium"
              >
                <Shield className="text-label-secondary h-4 w-4" />
                Intelligence tab
              </Label>
              <p className="text-label-secondary text-footnote">
                Show/hide the Intelligence navigation tab
              </p>
            </div>
          </div>
          <Switch
            id="intelligence-tab"
            checked={localSettings.showIntelligenceTab}
            onCheckedChange={(checked) => handleToggle("showIntelligenceTab", checked)}
          />
        </div>

        {/* Defense Tab Setting */}
        <div className="bg-surface border-separator rounded-control flex items-center justify-between border p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-control border-red/20 bg-red/10 border p-2">
              {localSettings.showDefenseTab ? (
                <Eye className="text-red h-4 w-4" />
              ) : (
                <EyeOff className="text-label-secondary h-4 w-4" />
              )}
            </div>
            <div>
              <Label
                htmlFor="defense-tab"
                className="text-body flex items-center gap-1 font-medium"
              >
                <Shield className="text-label-secondary h-4 w-4" />
                Defense tab
              </Label>
              <p className="text-label-secondary text-footnote">
                Show/hide the Defense & Security navigation tab in MyCountry
              </p>
            </div>
          </div>
          <Switch
            id="defense-tab"
            checked={localSettings.showDefenseTab}
            onCheckedChange={(checked) => handleToggle("showDefenseTab", checked)}
          />
        </div>

        {/* Maps Tab Setting */}
        <div className="bg-surface border-separator rounded-control flex items-center justify-between border p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-control border-orange/20 bg-orange/10 border p-2">
              {localSettings.showMapsTab ? (
                <Eye className="text-orange h-4 w-4" />
              ) : (
                <EyeOff className="text-label-secondary h-4 w-4" />
              )}
            </div>
            <div>
              <Label htmlFor="maps-tab" className="text-body font-medium">
                Maps tab
              </Label>
              <p className="text-label-secondary text-footnote">
                Show/hide the Maps navigation tab
              </p>
            </div>
          </div>
          <Switch
            id="maps-tab"
            checked={localSettings.showMapsTab}
            onCheckedChange={(checked) => handleToggle("showMapsTab", checked)}
          />
        </div>

        {/* Forum Tab Setting */}
        <div className="bg-surface border-separator rounded-control flex items-center justify-between border p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-control border-orange/20 bg-orange/10 border p-2">
              {localSettings.showForumTab ? (
                <Eye className="text-orange h-4 w-4" />
              ) : (
                <EyeOff className="text-label-secondary h-4 w-4" />
              )}
            </div>
            <div>
              <Label htmlFor="forum-tab" className="text-body font-medium">
                Forum tab
              </Label>
              <p className="text-label-secondary text-footnote">
                Show/hide the Forum navigation tab
              </p>
            </div>
          </div>
          <Switch
            id="forum-tab"
            checked={localSettings.showForumTab}
            onCheckedChange={(checked) => handleToggle("showForumTab", checked)}
          />
        </div>

        {/* Help Tab Setting */}
        <div className="bg-surface border-separator rounded-control flex items-center justify-between border p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-control border-yellow/20 bg-yellow/10 border p-2">
              {localSettings.showHelpTab ? (
                <Eye className="text-yellow h-4 w-4" />
              ) : (
                <EyeOff className="text-label-secondary h-4 w-4" />
              )}
            </div>
            <div>
              <Label htmlFor="help-tab" className="text-body font-medium">
                Help tab
              </Label>
              <p className="text-label-secondary text-footnote">
                Show/hide the Help navigation tab
              </p>
            </div>
          </div>
          <Switch
            id="help-tab"
            checked={localSettings.showHelpTab}
            onCheckedChange={(checked) => handleToggle("showHelpTab", checked)}
          />
        </div>

        {/* Save Button */}
        {hasChanges && (
          <div className="border-separator border-t pt-4">
            <Button onClick={handleSave} disabled={isSaving} className="w-full">
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save changes
                </>
              )}
            </Button>
          </div>
        )}

        {!hasChanges && navigationSettings && (
          <div className="border-separator border-t pt-4">
            <div className="text-label-secondary text-body flex items-center justify-center gap-2">
              <Check className="text-green h-4 w-4" />
              All changes saved
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
