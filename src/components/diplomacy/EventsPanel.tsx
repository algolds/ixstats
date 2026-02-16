"use client";

import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { FileText, HelpCircle } from "lucide-react";
import { DiplomaticEventsHub } from "~/app/mycountry/diplomacy/_components/DiplomaticEventsHub";
import { api } from "~/trpc/react";

interface EventsPanelProps {
  countryId: string;
}

export function EventsPanel({ countryId }: EventsPanelProps) {
  // Fetch country data to get country name
  const { data: country } = api.countries.getByIdBasic.useQuery(
    { id: countryId },
    { enabled: !!countryId }
  );

  return (
    <div className="space-y-4">
      {/* Header with Help */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-cyan-600" />
          <h3 className="text-sm font-semibold">Diplomatic Events</h3>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7">
              <HelpCircle className="h-4 w-4" />
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Diplomatic Events - Help</DialogTitle>
              <DialogDescription>Understanding event urgency, responses, and impact predictions</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">⚠️ Event Urgency Levels</h3>
                <div className="space-y-2 text-sm">
                  <p><strong>Critical (24h):</strong> Requires immediate attention - expires within 24 hours</p>
                  <p><strong>Warning (2-3 days):</strong> Important but less urgent</p>
                  <p><strong>Normal (3+ days):</strong> Standard diplomatic event timeline</p>
                </div>
              </div>
              <div>
                <h3 className="font-semibold mb-2">🎭 Event Types</h3>
                <div className="space-y-2 text-sm">
                  <p><strong>Border Dispute:</strong> Territorial disagreements requiring resolution</p>
                  <p><strong>Trade Renegotiation:</strong> Economic agreements up for review</p>
                  <p><strong>Cultural Misunderstanding:</strong> Diplomatic protocol issues</p>
                  <p><strong>Intelligence Breach:</strong> Security-related incidents</p>
                  <p><strong>Humanitarian Crisis:</strong> Emergency situations requiring aid</p>
                  <p><strong>Alliance Pressure:</strong> Coalition-related decisions</p>
                </div>
              </div>
              <div>
                <h3 className="font-semibold mb-2">✅ Response Options</h3>
                <div className="space-y-2 text-sm">
                  <p><strong>Accept:</strong> Agree to the proposal or demand</p>
                  <p><strong>Reject:</strong> Decline and potentially escalate tensions</p>
                  <p><strong>Negotiate:</strong> Seek middle ground through diplomacy</p>
                </div>
              </div>
              <div>
                <h3 className="font-semibold mb-2">📊 Impact Predictions</h3>
                <div className="space-y-2 text-sm">
                  <p><strong>Relationship Impact:</strong> Effect on bilateral relationship strength</p>
                  <p><strong>Economic Impact:</strong> Trade and financial consequences</p>
                  <p><strong>Cultural Impact:</strong> Soft power and influence changes</p>
                </div>
              </div>
              <div>
                <h3 className="font-semibold mb-2">💡 Tips</h3>
                <div className="space-y-1 text-sm text-muted-foreground">
                  <p>• Review impact predictions before making decisions</p>
                  <p>• Consider long-term relationship effects, not just short-term gains</p>
                  <p>• Urgent events require quick action but don't rush important decisions</p>
                  <p>• Check event history to learn from past scenarios</p>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <DiplomaticEventsHub
        countryId={countryId}
        countryName={country?.name || "Your Country"}
      />
    </div>
  );
}
