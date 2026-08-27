"use client";

import { useState } from "react";
import {
  Shield,
  Archery as Crosshair,
  SeaWaves as Anchor,
  Tournament as Swords,
  GraduationCap,
  Dollar as DollarSign,
  Group as Users,
  Xmark as X,
  NavArrowDown as ChevronDown,
  NavArrowUp as ChevronUp,
} from "iconoir-react";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "~/components/ui/alert-dialog";
import { api } from "~/trpc/react";

interface ActiveOperationsProps {
  countryId: string;
}

const OP_ICONS: Record<string, typeof Shield> = {
  peacekeeping: Shield,
  defense_pact: Crosshair,
  blockade: Anchor,
  intervention: Swords,
  training: GraduationCap,
};

const STATUS_COLORS: Record<string, string> = {
  planned: "border-yellow-500/50 text-yellow-500",
  active: "border-green-500/50 text-green-500",
  completed: "border-blue-500/50 text-blue-500",
  failed: "border-red-500/50 text-red-500",
  cancelled: "border-gray-500/50 text-gray-500",
};

export function ActiveOperations({ countryId }: ActiveOperationsProps) {
  const [showCompleted, setShowCompleted] = useState(false);

  const { data: operations, refetch } = api.security.getOperations.useQuery(
    { countryId, includeCompleted: showCompleted },
    { enabled: !!countryId }
  );

  const endMutation = api.security.endOperation.useMutation({
    onSuccess: () => void refetch(),
  });

  const formatCurrency = (val: number) => {
    if (val >= 1e9) return `$${(val / 1e9).toFixed(1)}B`;
    if (val >= 1e6) return `$${(val / 1e6).toFixed(1)}M`;
    return `$${val.toLocaleString()}`;
  };

  if (!operations || operations.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-red-500/30 p-6 text-center">
        <Shield className="mx-auto mb-3 h-8 w-8 text-red-500/40" />
        <p className="text-muted-foreground text-sm">
          No active operations. Deploy forces to begin a military operation.
        </p>
        <Button
          variant="ghost"
          size="sm"
          className="mt-2"
          onClick={() => setShowCompleted(!showCompleted)}
        >
          {showCompleted ? "Hide" : "Show"} past operations
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Operations ({operations.length})</h3>
        <Button variant="ghost" size="sm" onClick={() => setShowCompleted(!showCompleted)}>
          {showCompleted ? (
            <>
              <ChevronUp className="mr-1 h-3 w-3" /> Hide past
            </>
          ) : (
            <>
              <ChevronDown className="mr-1 h-3 w-3" /> Show all
            </>
          )}
        </Button>
      </div>

      {operations.map((op) => {
        const Icon = OP_ICONS[op.operationType] ?? Shield;
        const isActive = op.status === "active" || op.status === "planned";

        return (
          <div
            key={op.id}
            className={`rounded-lg border p-3 ${isActive ? "border-red-500/20" : "border-muted opacity-60"}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <Icon className="h-3.5 w-3.5 shrink-0 text-red-500" />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{op.name}</span>
                    <Badge variant="outline" className={STATUS_COLORS[op.status] ?? ""}>
                      {op.status}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground mt-1 text-xs">
                    {op.operationType.replace("_", " ")}
                    {op.targetCountry && (
                      <>
                        {" "}
                        — Target:{" "}
                        <span className="text-foreground font-medium">{op.targetCountry.name}</span>
                      </>
                    )}
                  </p>
                  {op.description && (
                    <p className="text-muted-foreground mt-1 text-xs">{op.description}</p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3">
                {/* Stats */}
                <div className="space-y-1 text-right text-xs">
                  <div className="text-muted-foreground flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {op.personnelDeployed.toLocaleString()}
                  </div>
                  <div className="flex items-center gap-1 text-red-500">
                    <DollarSign className="h-3 w-3" />
                    {formatCurrency(op.dailyCost)}/day
                  </div>
                  {op.gdpDrain > 0 && (
                    <span className="text-[10px] text-red-500">
                      {(op.gdpDrain * 100).toFixed(3)}% GDP drain
                    </span>
                  )}
                </div>

                {/* End operation */}
                {isActive && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <X className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>End Operation?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will recall all deployed forces and end the operation. Unit readiness
                          will partially recover.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogClose asChild>
                          <Button variant="outline">Cancel</Button>
                        </AlertDialogClose>
                        <AlertDialogClose asChild>
                          <Button
                            onClick={() =>
                              endMutation.mutate({
                                operationId: op.id,
                                successRating: "success",
                              })
                            }
                            disabled={endMutation.isPending}
                          >
                            End Operation
                          </Button>
                        </AlertDialogClose>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            </div>

            {/* Deployment count */}
            {op.deployments && op.deployments.length > 0 && (
              <div className="text-muted-foreground mt-2 text-xs">
                {op.deployments.filter((d) => d.status === "deployed").length} active deployments
                {op.casualties > 0 && (
                  <span className="ml-2 text-red-500">{op.casualties} casualties</span>
                )}
              </div>
            )}

            {/* Success rating for completed ops */}
            {op.successRating && (
              <Badge
                variant="outline"
                className={`mt-2 ${
                  op.successRating === "success"
                    ? "border-green-500/50 text-green-500"
                    : op.successRating === "partial"
                      ? "border-yellow-500/50 text-yellow-500"
                      : "border-red-500/50 text-red-500"
                }`}
              >
                {op.successRating}
              </Badge>
            )}
          </div>
        );
      })}
    </div>
  );
}
