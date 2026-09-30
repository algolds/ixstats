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
import { FacetContainer } from "~/components/ui/facet-container";
import { cn } from "~/lib/utils";
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
import { formatCurrency } from "~/lib/utils/format-utils";

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

/** Operation status → semantic outline-badge colour. */
const STATUS_COLORS: Record<string, string> = {
  planned: "border-amber-500/30 text-amber-600",
  active: "border-emerald-500/30 text-emerald-600",
  completed: "text-muted-foreground",
  failed: "border-destructive/30 text-destructive",
  cancelled: "text-muted-foreground",
};

const SUCCESS_RATING_COLORS: Record<string, string> = {
  success: "border-emerald-500/30 text-emerald-600",
  partial: "border-amber-500/30 text-amber-600",
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

  if (!operations || operations.length === 0) {
    return (
      <div className="border-border rounded-lg border border-dashed p-6 text-center">
        <Shield aria-hidden="true" className="text-muted-foreground mx-auto mb-3 h-8 w-8" />
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
        <h3 className="text-foreground text-sm font-semibold">Operations ({operations.length})</h3>
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
          <FacetContainer
            key={op.id}
            depth={3}
            surface="solid"
            enableRefraction={false}
            className={cn("rounded-lg p-3", !isActive && "opacity-60")}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <Icon
                  aria-hidden="true"
                  className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0"
                />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-foreground text-sm font-medium">{op.name}</span>
                    <Badge variant="outline" className={cn("capitalize", STATUS_COLORS[op.status])}>
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
                  <div className="text-foreground flex items-center gap-1 tabular-nums">
                    <DollarSign aria-hidden="true" className="text-muted-foreground h-3 w-3" />
                    {formatCurrency(op.dailyCost)}/day
                  </div>
                  {op.gdpDrain > 0 && (
                    <span className="text-destructive text-xs">
                      {(op.gdpDrain * 100).toFixed(3)}% GDP drain
                    </span>
                  )}
                </div>

                {/* End operation */}
                {isActive && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        aria-label={`End ${op.name}`}
                      >
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
                  <span className="text-destructive ml-2">{op.casualties} casualties</span>
                )}
              </div>
            )}

            {/* Success rating for completed ops */}
            {op.successRating && (
              <Badge
                variant="outline"
                className={cn(
                  "mt-2 capitalize",
                  SUCCESS_RATING_COLORS[op.successRating] ??
                    "border-destructive/30 text-destructive"
                )}
              >
                {op.successRating}
              </Badge>
            )}
          </FacetContainer>
        );
      })}
    </div>
  );
}
