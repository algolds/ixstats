"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";
import { Loader2, Navigation, Eye, EyeOff, Save, Check, Shield } from "lucide-react";
import { api } from "~/trpc/react";
import { toast } from "sonner";

export function NavigationSettings() {
  const [localSettings, setLocalSettings] = useState({
    showWikiTab: true,
    showCardsTab: true,
    showLabsTab: true,
    showIntelligenceTab: false,
  });
  const [isSaving, setIsSaving] = useState(false);

  // Query to get current navigation settings
  const { data: navigationSettings, isLoading, refetch } = api.admin.getNavigationSettings.useQuery();

  // Update local settings when data arrives
  useEffect(() => {
    if (navigationSettings) {
      setLocalSettings(prev => ({
        ...prev,
        ...navigationSettings
      }));
    }
  }, [navigationSettings]);

  // Mutation to update navigation settings
  const updateSettingsMutation = api.admin.updateNavigationSettings.useMutation({
    onSuccess: () => {
      toast.success("Navigation settings updated successfully");
      refetch();
      setIsSaving(false);
    },
    onError: (error) => {
      toast.error(`Failed to update settings: ${error.message}`);
      setIsSaving(false);
    },
  });

  const handleSave = async () => {
    setIsSaving(true);
    updateSettingsMutation.mutate(localSettings);
  };

  const handleToggle = (setting: keyof typeof localSettings, value: boolean) => {
    setLocalSettings(prev => ({
      ...prev,
      [setting]: value
    }));
  };

  const hasChanges = navigationSettings && (
    navigationSettings.showWikiTab !== localSettings.showWikiTab ||
    navigationSettings.showCardsTab !== localSettings.showCardsTab ||
    navigationSettings.showLabsTab !== localSettings.showLabsTab ||
    navigationSettings.showIntelligenceTab !== localSettings.showIntelligenceTab
  );

  if (isLoading) {
    return (
      <Card className="glass-card-parent">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Navigation className="h-5 w-5" />
            Navigation Settings
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass-card-parent">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Navigation className="h-5 w-5" />
          Navigation Settings
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Control which navigation tabs are visible to users. These tabs can be hidden to simplify the navigation bar.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Wiki Tab Setting */}
        <div className="flex items-center justify-between p-4 rounded-lg bg-card/50 border border-border/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
              {localSettings.showWikiTab ? (
                <Eye className="h-4 w-4 text-blue-500" />
              ) : (
                <EyeOff className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
            <div>
              <Label htmlFor="wiki-tab" className="text-sm font-medium">
                Wiki Tab
              </Label>
              <p className="text-xs text-muted-foreground">
                Show/hide the Wiki navigation tab
              </p>
            </div>
          </div>
          <Switch
            id="wiki-tab"
            checked={localSettings.showWikiTab}
            onCheckedChange={(checked) => handleToggle('showWikiTab', checked)}
          />
        </div>

        {/* Cards Tab Setting */}
        <div className="flex items-center justify-between p-4 rounded-lg bg-card/50 border border-border/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
              {localSettings.showCardsTab ? (
                <Eye className="h-4 w-4 text-cyan-500" />
              ) : (
                <EyeOff className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
            <div>
              <Label htmlFor="cards-tab" className="text-sm font-medium">
                Cards Tab
              </Label>
              <p className="text-xs text-muted-foreground">
                Show/hide the Cards navigation tab
              </p>
            </div>
          </div>
          <Switch
            id="cards-tab"
            checked={localSettings.showCardsTab}
            onCheckedChange={(checked) => handleToggle('showCardsTab', checked)}
          />
        </div>

        {/* Labs Tab Setting */}
        <div className="flex items-center justify-between p-4 rounded-lg bg-card/50 border border-border/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-500/10 border border-purple-500/20">
              {localSettings.showLabsTab ? (
                <Eye className="h-4 w-4 text-purple-500" />
              ) : (
                <EyeOff className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
            <div>
              <Label htmlFor="labs-tab" className="text-sm font-medium">
                Labs Tab
              </Label>
              <p className="text-xs text-muted-foreground">
                Show/hide the Labs navigation tab and dropdown
              </p>
            </div>
          </div>
          <Switch
            id="labs-tab"
            checked={localSettings.showLabsTab}
            onCheckedChange={(checked) => handleToggle('showLabsTab', checked)}
          />
        </div>

        {/* Intelligence Tab Setting */}
        <div className="flex items-center justify-between p-4 rounded-lg bg-card/50 border border-border/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              {localSettings.showIntelligenceTab ? (
                <Eye className="h-4 w-4 text-emerald-500" />
              ) : (
                <EyeOff className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
            <div>
              <Label htmlFor="intelligence-tab" className="text-sm font-medium flex items-center gap-1">
                <Shield className="h-4 w-4 text-muted-foreground" />
                Intelligence Tab
              </Label>
              <p className="text-xs text-muted-foreground">
                Show/hide the Intelligence navigation tab
              </p>
            </div>
          </div>
          <Switch
            id="intelligence-tab"
            checked={localSettings.showIntelligenceTab}
            onCheckedChange={(checked) => handleToggle('showIntelligenceTab', checked)}
          />
        </div>

        {/* Save Button */}
        {hasChanges && (
          <div className="pt-4 border-t border-border/50">
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="w-full"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        )}

        {!hasChanges && navigationSettings && (
          <div className="pt-4 border-t border-border/50">
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Check className="h-4 w-4 text-green-500" />
              All changes saved
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
