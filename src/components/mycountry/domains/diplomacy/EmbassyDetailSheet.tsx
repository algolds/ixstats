"use client";

import { api } from "~/trpc/react";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "~/components/ui/sheet";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Skeleton } from "~/components/ui/skeleton";
import { Separator } from "~/components/ui/separator";
import { Progress } from "~/components/ui/progress";
import { Eyebrow } from "~/components/ui/eyebrow";
import {
  City as Building2,
  User,
  Group as Users,
  MapPin,
  Dollar as DollarSign,
  StatUp as TrendingUp,
  Star,
  Flash as Zap,
  Clock,
  CheckCircle,
  XmarkCircle as XCircle,
} from "iconoir-react";
import { useNotify } from "~/hooks/useNotify";

interface EmbassyDetailSheetProps {
  embassyId: string | null;
  onClose: () => void;
  countryId: string;
  onEmbassyChanged?: () => void;
}

function InfoRow({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string | React.ReactNode;
  icon?: typeof Building2;
}) {
  return (
    <div className="flex items-start justify-between gap-2">
      <span className="text-label-secondary text-footnote flex items-center gap-2">
        {Icon && <Icon className="h-3 w-3" />}
        {label}
      </span>
      <span className="text-label text-caption text-right">{value}</span>
    </div>
  );
}

function StatBar({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div>
      <div className="text-footnote mb-1 flex items-center justify-between">
        <span className="text-label-secondary">{label}</span>
        <span className="text-label font-medium tabular-nums">{value}</span>
      </div>
      <Progress value={pct} className="h-1.5" />
    </div>
  );
}

export function EmbassyDetailSheet({
  embassyId,
  onClose,
  countryId: _countryId,
  onEmbassyChanged,
}: EmbassyDetailSheetProps) {
  const notify = useNotify();
  const isOpen = embassyId !== null;

  const { data: embassy, isLoading } = api.diplomaticEmbassies.getEmbassyDetails.useQuery(
    { embassyId: embassyId! },
    { enabled: !!embassyId }
  );

  const closeMutation = api.diplomaticEmbassies.closeEmbassy.useMutation({
    onSuccess: () => {
      notify.success("Embassy closed.");
      onEmbassyChanged?.();
      onClose();
    },
    onError: (error) => {
      notify.error(`Failed to close embassy: ${error.message}`);
    },
  });

  const reopenMutation = api.diplomaticEmbassies.reopenEmbassy.useMutation({
    onSuccess: () => {
      notify.success("Embassy reopened.");
      onEmbassyChanged?.();
      onClose();
    },
    onError: (error) => {
      notify.error(`Failed to reopen embassy: ${error.message}`);
    },
  });

  const severMutation = api.diplomaticEmbassies.deleteEmbassy.useMutation({
    onSuccess: () => {
      notify.success("Diplomatic relations severed and embassy deleted.");
      onEmbassyChanged?.();
      onClose();
    },
    onError: (error) => {
      notify.error(`Failed to sever relations: ${error.message}`);
    },
  });

  const getStatusBadge = (status: string | undefined) => {
    const s = status?.toLowerCase() ?? "active";
    if (s === "active")
      return (
        <Badge variant="success">
          <CheckCircle />
          Active
        </Badge>
      );
    if (s === "closed")
      return (
        <Badge variant="destructive">
          <XCircle />
          Closed
        </Badge>
      );
    if (s === "under_construction")
      return (
        <Badge variant="warning">
          <Clock />
          Building
        </Badge>
      );
    return <Badge variant="outline">{s}</Badge>;
  };

  const getLevelBadge = (level: number | undefined) => {
    const labels: Record<number, string> = {
      1: "Consulate",
      2: "Standard Embassy",
      3: "Grand Embassy",
    };
    const l = level ?? 1;
    return <Badge variant="default">{labels[l] ?? `Level ${l}`}</Badge>;
  };

  const missions = embassy?.missions ?? [];
  const activeMissions = missions.filter((m) => m.status === "active");

  return (
    <Sheet
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent className="flex flex-col gap-0 overflow-hidden p-0">
        <SheetHeader className="px-6 pt-6 pb-0">
          <SheetTitle className="flex items-start gap-2">
            <Building2 className="text-label-secondary mt-0.5 h-5 w-5 shrink-0" />
            <span className="line-clamp-2">
              {isLoading ? "Loading…" : (embassy?.name ?? "Embassy not found")}
            </span>
          </SheetTitle>
          {embassy && (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              {getStatusBadge(embassy.status)}
              {getLevelBadge(embassy.level)}
            </div>
          )}
        </SheetHeader>

        {isLoading ? (
          <div className="space-y-4 px-6 py-4">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : embassy ? (
          <>
            <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
              {/* Countries Info */}
              <div className="space-y-2">
                <InfoRow
                  label="Host country"
                  value={embassy.hostCountryName ?? embassy.hostCountryId}
                  icon={MapPin}
                />
                <InfoRow
                  label="Guest country"
                  value={embassy.guestCountryName ?? embassy.guestCountryId}
                  icon={Building2}
                />
                {embassy.ambassadorName && (
                  <InfoRow label="Ambassador" value={embassy.ambassadorName} icon={User} />
                )}
                {embassy.location && (
                  <InfoRow label="Location" value={embassy.location} icon={MapPin} />
                )}
                <InfoRow
                  label="Staff"
                  value={`${embassy.staffCount ?? 0} personnel`}
                  icon={Users}
                />
                {/* Served only to the nation that runs the embassy. */}
                {embassy.budget != null && (
                  <InfoRow
                    label="Budget"
                    value={`$${embassy.budget.toLocaleString()}/mo`}
                    icon={DollarSign}
                  />
                )}
              </div>

              <Separator />

              {/* Performance Stats */}
              <div>
                <Eyebrow className="mb-2 flex items-center gap-2">
                  <TrendingUp className="h-3.5 w-3.5" />
                  Performance
                </Eyebrow>
                <div className="space-y-2">
                  <StatBar label="Effectiveness" value={embassy.effectiveness ?? 0} max={100} />
                  <StatBar label="Influence" value={embassy.influence ?? 0} max={100} />
                  <StatBar label="Reputation" value={embassy.reputation ?? 0} max={100} />
                  <StatBar label="Experience" value={embassy.experience ?? 0} max={1000} />
                </div>
              </div>

              {/* Active Missions */}
              {activeMissions.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <Eyebrow className="mb-2 flex items-center gap-2">
                      <Zap className="h-3.5 w-3.5" />
                      Active Missions ({activeMissions.length})
                    </Eyebrow>
                    <div className="space-y-2">
                      {activeMissions.map((m) => (
                        <div
                          key={m.id}
                          className="border-separator bg-surface rounded-control text-footnote border p-2"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-label font-medium">{m.name}</span>
                            <Badge variant="outline">{m.type}</Badge>
                          </div>
                          {m.progress != null && (
                            <div className="mt-2">
                              <Progress value={m.progress} className="h-1" />
                              <span className="text-label-secondary text-footnote mt-0.5 block">
                                {m.progress}% complete
                              </span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* Specialization / Synergies */}
              {embassy.specialization && (
                <>
                  <Separator />
                  <div>
                    <Eyebrow className="mb-2 flex items-center gap-2">
                      <Star className="h-3.5 w-3.5" />
                      Specialization
                    </Eyebrow>
                    <Badge variant="default">{embassy.specialization}</Badge>
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            <SheetFooter className="border-separator border-t px-6 py-4">
              <Button variant="outline" size="sm" onClick={onClose}>
                Close
              </Button>
              {embassy.status === "active" && (
                <>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="gap-2"
                    onClick={() => closeMutation.mutate({ embassyId: embassy.id })}
                    disabled={closeMutation.isPending}
                  >
                    <XCircle className="h-3 w-3" />
                    {closeMutation.isPending ? "Closing…" : "Close Embassy"}
                  </Button>
                </>
              )}
              {embassy.status === "closed" && (
                <>
                  <Button
                    size="sm"
                    variant="default"
                    className="gap-2"
                    onClick={() => reopenMutation.mutate({ embassyId: embassy.id })}
                    disabled={reopenMutation.isPending}
                  >
                    <CheckCircle className="h-3 w-3" />
                    {reopenMutation.isPending ? "Reopening…" : "Reopen Embassy"}
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="gap-2"
                    onClick={() => severMutation.mutate({ embassyId: embassy.id })}
                    disabled={severMutation.isPending}
                  >
                    <XCircle className="h-3 w-3" />
                    {severMutation.isPending ? "Severing…" : "Sever Relations"}
                  </Button>
                </>
              )}
            </SheetFooter>
          </>
        ) : (
          <div className="text-label-secondary flex flex-1 items-center justify-center">
            Embassy not found.
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
