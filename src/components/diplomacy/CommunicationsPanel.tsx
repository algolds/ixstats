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
import { HelpCircle } from "lucide-react";
import { SecureCommunications } from "~/app/mycountry/intelligence/_components/SecureCommunications";
import { api } from "~/trpc/react";

interface CommunicationsPanelProps {
  countryId: string;
}

export function CommunicationsPanel({ countryId }: CommunicationsPanelProps) {
  // Fetch country data to get country name
  const { data: country } = api.countries.getByIdBasic.useQuery(
    { id: countryId },
    { enabled: !!countryId }
  );

  return (
    <div className="space-y-6">
      {/* Header with Help */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Secure Communications</h2>
          <p className="text-muted-foreground text-sm">Encrypted diplomatic messaging</p>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline" size="icon">
              <HelpCircle className="h-4 w-4" />
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Secure Communications - Help</DialogTitle>
              <DialogDescription>Understanding security classifications, encryption, and channels</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">🔒 Security Classifications</h3>
                <div className="space-y-2 text-sm">
                  <p><strong>PUBLIC:</strong> General diplomatic correspondence</p>
                  <p><strong>RESTRICTED:</strong> Internal government communications</p>
                  <p><strong>CONFIDENTIAL:</strong> Sensitive diplomatic matters</p>
                  <p><strong>SECRET:</strong> Highly sensitive state affairs</p>
                  <p><strong>TOP SECRET:</strong> Most critical national security matters</p>
                </div>
              </div>
              <div>
                <h3 className="font-semibold mb-2">🔐 Encryption Status</h3>
                <div className="space-y-2 text-sm">
                  <p><strong>Encrypted:</strong> End-to-end encrypted with verified keys</p>
                  <p><strong>Signature Verified:</strong> Sender identity confirmed</p>
                  <p><strong>Key Expiry:</strong> Encryption keys have expiration dates</p>
                </div>
              </div>
              <div>
                <h3 className="font-semibold mb-2">📡 Channel Types</h3>
                <div className="space-y-2 text-sm">
                  <p><strong>BILATERAL:</strong> One-on-one communication between two nations</p>
                  <p><strong>MULTILATERAL:</strong> Group communication with multiple nations</p>
                  <p><strong>EMERGENCY:</strong> High-priority crisis communication</p>
                </div>
              </div>
              <div>
                <h3 className="font-semibold mb-2">💡 Tips</h3>
                <div className="space-y-1 text-sm text-muted-foreground">
                  <p>• Always verify encryption status before sending sensitive information</p>
                  <p>• Use appropriate classification levels for message content</p>
                  <p>• Emergency channels are monitored 24/7 for urgent matters</p>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <SecureCommunications
        countryId={countryId}
        countryName={country?.name || "Your Country"}
      />
    </div>
  );
}
