"use client";

import { api } from "~/trpc/react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Skeleton } from "~/components/ui/skeleton";
import { Separator } from "~/components/ui/separator";
import {
  Building2,
  User,
  Users,
  MapPin,
  DollarSign,
  TrendingUp,
  Star,
  Zap,
  Clock,
  CheckCircle,
  ArrowUpCircle,
  XCircle,
} from "lucide-react";
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
      <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
        {Icon && <Icon className="h-3 w-3" />}
        {label}
      </span>
      <span className="text-right text-xs font-medium">{value}</span>
    </div>
  );
}

function StatBar({
  label,
  value,
  max,
  color,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
}) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{value}</span>
      </div>
      <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
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

  const getStatusBadge = (status: string | undefined) => {
    const s = status?.toLowerCase() ?? "active";
    if (s === "active")
      return (
        <Badge className="bg-green-100 text-green-700 dark:bg-green-950/30">
          <CheckCircle className="mr-1 h-3 w-3" />
          Active
        </Badge>
      );
    if (s === "closed")
      return (
        <Badge className="bg-red-100 text-red-700 dark:bg-red-950/30">
          <XCircle className="mr-1 h-3 w-3" />
          Closed
        </Badge>
      );
    if (s === "under_construction")
      return (
        <Badge className="bg-yellow-100 text-yellow-700 dark:bg-yellow-950/30">
          <Clock className="mr-1 h-3 w-3" />
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
    const colors: Record<number, string> = {
      1: "bg-blue-50 text-blue-700 dark:bg-blue-950/20",
      2: "bg-cyan-50 text-cyan-700 dark:bg-cyan-950/20",
      3: "bg-purple-50 text-purple-700 dark:bg-purple-950/20",
    };
    const l = level ?? 1;
    return (
      <Badge variant="secondary" className={`text-xs ${colors[l] ?? ""}`}>
        {labels[l] ?? `Level ${l}`}
      </Badge>
    );
  };

  const missions = (embassy as any)?.missions ?? [];
  const activeMissions = missions.filter((m: any) => m.status === "active");

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        className="sm:max-w-lg"
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 0,
          padding: 0,
          maxHeight: "85vh",
          overflow: "hidden",
        }}
      >
        <DialogHeader className="px-6 pt-6 pb-0">
          <DialogTitle className="flex items-start gap-2">
            <Building2 className="mt-0.5 h-5 w-5 shrink-0 text-cyan-500" />
            <span className="line-clamp-2">
              {isLoading ? "Loading..." : (embassy?.name ?? "Embassy Not Found")}
            </span>
          </DialogTitle>
          {embassy && (
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              {getStatusBadge(embassy.status)}
              {getLevelBadge(embassy.level)}
            </div>
          )}
        </DialogHeader>

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
                  label="Host Country"
                  value={(embassy as any).hostCountryName ?? embassy.hostCountryId}
                  icon={MapPin}
                />
                <InfoRow
                  label="Guest Country"
                  value={(embassy as any).guestCountryName ?? embassy.guestCountryId}
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
                <InfoRow
                  label="Budget"
                  value={`$${(embassy.budget ?? 0).toLocaleString()}/mo`}
                  icon={DollarSign}
                />
              </div>

              <Separator />

              {/* Performance Stats */}
              <div>
                <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold">
                  <TrendingUp className="h-3.5 w-3.5 text-cyan-500" />
                  Performance
                </h4>
                <div className="space-y-2.5">
                  <StatBar
                    label="Effectiveness"
                    value={embassy.effectiveness ?? 0}
                    max={100}
                    color="#06b6d4"
                  />
                  <StatBar
                    label="Influence"
                    value={embassy.influence ?? 0}
                    max={100}
                    color="#3b82f6"
                  />
                  <StatBar
                    label="Reputation"
                    value={embassy.reputation ?? 0}
                    max={100}
                    color="#a855f7"
                  />
                  <StatBar
                    label="Experience"
                    value={embassy.experience ?? 0}
                    max={1000}
                    color="#22c55e"
                  />
                </div>
              </div>

              {/* Active Missions */}
              {activeMissions.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold">
                      <Zap className="h-3.5 w-3.5 text-cyan-500" />
                      Active Missions ({activeMissions.length})
                    </h4>
                    <div className="space-y-2">
                      {activeMissions.map((m: any) => (
                        <div
                          key={m.id}
                          className="border-border/40 bg-muted/30 rounded-md border p-2 text-xs"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{m.name}</span>
                            <Badge variant="outline" className="text-[10px]">
                              {m.type}
                            </Badge>
                          </div>
                          {m.progress != null && (
                            <div className="mt-1.5">
                              <div className="bg-muted h-1 w-full overflow-hidden rounded-full">
                                <div
                                  className="h-full rounded-full bg-cyan-500 transition-all"
                                  style={{ width: `${m.progress}%` }}
                                />
                              </div>
                              <span className="text-muted-foreground mt-0.5 block text-[10px]">
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
                    <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold">
                      <Star className="h-3.5 w-3.5 text-cyan-500" />
                      Specialization
                    </h4>
                    <Badge variant="secondary">{embassy.specialization}</Badge>
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            <DialogFooter className="border-border/50 border-t px-6 py-4">
              <Button variant="outline" size="sm" onClick={onClose}>
                Close
              </Button>
              {embassy.status === "active" && (
                <>
                  <Button size="sm" variant="outline" className="gap-1.5" disabled>
                    <ArrowUpCircle className="h-3 w-3" />
                    Upgrade (Coming Soon)
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="gap-1.5"
                    onClick={() => closeMutation.mutate({ embassyId: embassy.id })}
                    disabled={closeMutation.isPending}
                  >
                    <XCircle className="h-3 w-3" />
                    {closeMutation.isPending ? "Closing..." : "Close Embassy"}
                  </Button>
                </>
              )}
            </DialogFooter>
          </>
        ) : (
          <div className="text-muted-foreground flex flex-1 items-center justify-center">
            Embassy not found.
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
