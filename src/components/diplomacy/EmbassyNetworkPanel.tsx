"use client";

import { Card, CardContent } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { HelpCircle } from "lucide-react";
import { EnhancedEmbassyNetwork } from "~/components/diplomatic/EnhancedEmbassyNetwork";
import { useUser } from "~/context/auth-context";
import { api } from "~/trpc/react";

interface EmbassyNetworkPanelProps {
  countryId: string;
}

export function EmbassyNetworkPanel({ countryId }: EmbassyNetworkPanelProps) {
  const { user } = useUser();

  // Get user profile for country context
  const { data: userProfile } = api.users.getProfile.useQuery(undefined, { enabled: !!user?.id });

  // Fetch country data to get country name
  const { data: country } = api.countries.getByIdBasic.useQuery(
    { id: countryId },
    { enabled: !!countryId }
  );

  // Determine if user is the owner
  const isOwner = userProfile?.countryId === countryId;

  if (!country) {
    return (
      <Card className="glass-hierarchy-child">
        <CardContent className="py-12">
          <div className="text-muted-foreground text-center">Loading embassy network...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Help */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Embassy Network</h2>
          <p className="text-muted-foreground text-sm">Manage your diplomatic embassies</p>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline" size="icon">
              <HelpCircle className="h-4 w-4" />
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Embassy Network - Help</DialogTitle>
              <DialogDescription>Understanding embassy levels, synergies, and management</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">🏛️ Embassy Levels</h3>
                <div className="space-y-2 text-sm">
                  <p><strong>Consulate:</strong> Basic diplomatic presence (Budget: Low)</p>
                  <p><strong>Standard Embassy:</strong> Full diplomatic mission (Budget: Medium)</p>
                  <p><strong>Grand Embassy:</strong> Major diplomatic hub (Budget: High)</p>
                </div>
              </div>
              <div>
                <h3 className="font-semibold mb-2">⚡ Synergy System</h3>
                <div className="space-y-2 text-sm">
                  <p><strong>Cultural Synergy:</strong> Increases cultural exchange effectiveness</p>
                  <p><strong>Economic Synergy:</strong> Boosts trade and economic cooperation</p>
                  <p><strong>Military Synergy:</strong> Enhances defense cooperation potential</p>
                </div>
              </div>
              <div>
                <h3 className="font-semibold mb-2">💰 Budget Allocation</h3>
                <div className="space-y-2 text-sm">
                  <p>Higher budget levels improve:</p>
                  <p>• Relationship growth rate</p>
                  <p>• Intelligence gathering capabilities</p>
                  <p>• Cultural influence projection</p>
                </div>
              </div>
              <div>
                <h3 className="font-semibold mb-2">💡 Tips</h3>
                <div className="space-y-1 text-sm text-muted-foreground">
                  <p>• Upgrade embassies in strategic locations</p>
                  <p>• Monitor synergy bonuses for maximum effectiveness</p>
                  <p>• Balance budget across your embassy network</p>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <EnhancedEmbassyNetwork
        countryId={countryId}
        countryName={country.name}
        isOwner={isOwner}
      />
    </div>
  );
}
