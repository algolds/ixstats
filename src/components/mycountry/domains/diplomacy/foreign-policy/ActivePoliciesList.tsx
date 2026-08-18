// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
"use client";

import { useState } from "react";
import {
  AlertTriangle,
  Ban,
  HandshakeIcon,
  Shield,
  ShipWheel,
  ArrowUpRight,
  ArrowDownRight,
  X,
} from "lucide-react";
import { Button, buttonVariants } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { UnifiedCountryFlag } from "~/components/ui/UnifiedCountryFlag";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "~/components/ui/alert-dialog";
import { api } from "~/trpc/react";
import { useScrollToFocus } from "~/hooks/useScrollToFocus";

interface ActivePoliciesListProps {
  countryId: string;
  /** When set, scroll to + highlight this policy row. */
  focusId?: string | null;
}

const ACTION_CONFIG: Record<
  string,
  { icon: typeof Ban; label: string; color: string; bgColor: string }
> = {
  embargo: { icon: Ban, label: "Embargo", color: "text-red-500", bgColor: "bg-red-500/10" },
  sanction: {
    icon: AlertTriangle,
    label: "Sanction",
    color: "text-orange-500",
    bgColor: "bg-orange-500/10",
  },
  free_trade: {
    icon: HandshakeIcon,
    label: "Free Trade Agreement",
    color: "text-green-500",
    bgColor: "bg-green-500/10",
  },
  military_alliance: {
    icon: Shield,
    label: "Military Alliance",
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
  },
  blockade: {
    icon: ShipWheel,
    label: "Blockade",
    color: "text-red-700",
    bgColor: "bg-red-700/10",
  },
};

export function ActivePoliciesList({ countryId, focusId }: ActivePoliciesListProps) {
  const [showExpired, setShowExpired] = useState(false);

  const { data: policies, refetch } = api.diplomaticPolicies.getActiveForeignPolicies.useQuery(
    { countryId, includeExpired: showExpired },
    { enabled: !!countryId }
  );

  useScrollToFocus(focusId, [policies]);

  const liftMutation = api.diplomaticPolicies.liftForeignPolicyAction.useMutation({
    onSuccess: () => void refetch(),
  });

  if (!policies || policies.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-cyan-500/30 p-8 text-center">
        <HandshakeIcon className="mx-auto mb-3 h-10 w-10 text-cyan-500/40" />
        <p className="text-muted-foreground text-sm">
          No active foreign policy actions. Use the panel above to propose embargoes, sanctions, or
          trade agreements.
        </p>
        <Button
          variant="ghost"
          size="sm"
          className="mt-2"
          onClick={() => setShowExpired(!showExpired)}
        >
          {showExpired ? "Hide" : "Show"} expired/lifted actions
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Active Foreign Policies ({policies.length})</h3>
        <Button variant="ghost" size="sm" onClick={() => setShowExpired(!showExpired)}>
          {showExpired ? "Hide expired" : "Show all"}
        </Button>
      </div>

      {policies.map((policy) => {
        const config = ACTION_CONFIG[policy.actionType] ?? ACTION_CONFIG.embargo!;
        const Icon = config.icon;
        const isInitiator = policy.initiatorId === countryId;
        const otherCountry = isInitiator ? policy.target : policy.initiator;
        const myImpact = isInitiator ? policy.initiatorGdpImpact : policy.targetGdpImpact;
        const isNegative = myImpact < 0;

        return (
          <div
            key={policy.id}
            data-focus-id={policy.id}
            className={`rounded-lg border p-4 ${
              policy.status === "active" ? "border-cyan-500/20" : "border-muted opacity-60"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className={`rounded-lg p-2 ${config.bgColor}`}>
                  <Icon className={`h-4 w-4 ${config.color}`} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{config.label}</span>
                    <Badge
                      variant="outline"
                      className={
                        policy.status === "active"
                          ? "border-green-500/50 text-green-500"
                          : "border-muted text-muted-foreground"
                      }
                    >
                      {policy.status}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {policy.severity}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground mt-1 flex items-center gap-1 text-xs">
                    {isInitiator ? "Imposed on" : "Received from"}{" "}
                    <UnifiedCountryFlag
                      countryName={otherCountry.name}
                      flagUrl={otherCountry.flag}
                      size="xs"
                      showTooltip={false}
                    />
                    <span className="text-foreground font-medium">{otherCountry.name}</span>
                  </p>
                  {policy.reason && (
                    <p className="text-muted-foreground mt-1 text-xs italic">
                      &quot;{policy.reason}&quot;
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3">
                {/* GDP impact indicator */}
                <div className="text-right">
                  <div
                    className={`flex items-center gap-1 text-xs font-medium ${
                      isNegative ? "text-red-500" : "text-green-500"
                    }`}
                  >
                    {isNegative ? (
                      <ArrowDownRight className="h-3 w-3" />
                    ) : (
                      <ArrowUpRight className="h-3 w-3" />
                    )}
                    {(Math.abs(myImpact) * 100).toFixed(2)}% GDP
                  </div>
                  <span className="text-muted-foreground text-[10px]">
                    Relationship: {policy.relationshipDelta > 0 ? "+" : ""}
                    {policy.relationshipDelta}
                  </span>
                </div>

                {/* Lift button — only for initiator on active actions */}
                {isInitiator && policy.status === "active" && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <X className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Lift {config.label}?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will end the {config.label.toLowerCase()} against {otherCountry.name}
                          . Economic effects will cease and partial diplomatic recovery will begin.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogClose asChild>
                          <Button variant="outline">Cancel</Button>
                        </AlertDialogClose>
                        <AlertDialogAction asChild>
                          <Button
                            variant="destructive"
                            onClick={() => liftMutation.mutate({ actionId: policy.id })}
                            disabled={liftMutation.isPending}
                          >
                            {liftMutation.isPending ? "Lifting..." : "Confirm Lift"}
                          </Button>
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
