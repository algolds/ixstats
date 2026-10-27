"use client";

import { api, type RouterOutputs } from "~/trpc/react";
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

type IconType = React.ComponentType<{ className?: string }>;

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
  icon?: IconType;
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

const STATUS_BADGES: Record<
  string,
  { variant: "success" | "destructive" | "warning"; icon: IconType; label: string }
> = {
  active: { variant: "success", icon: CheckCircle, label: "Active" },
  closed: { variant: "destructive", icon: XCircle, label: "Closed" },
  under_construction: { variant: "warning", icon: Clock, label: "Building" },
};

const LEVEL_LABELS: Record<number, string> = {
  1: "Consulate",
  2: "Standard Embassy",
  3: "Grand Embassy",
};

function StatusBadge({ status }: { status: string | undefined }) {
  const s = status?.toLowerCase() ?? "active";
  const badge = STATUS_BADGES[s];
  if (!badge) return <Badge variant="outline">{s}</Badge>;
  return (
    <Badge variant={badge.variant}>
      <badge.icon />
      {badge.label}
    </Badge>
  );
}

function SectionTitle({ icon: Icon, children }: { icon: IconType; children: React.ReactNode }) {
  return (
    <Eyebrow className="mb-2 flex items-center gap-2">
      <Icon className="h-3.5 w-3.5" />
      {children}
    </Eyebrow>
  );
}

type EmbassyDetails = NonNullable<RouterOutputs["diplomaticEmbassies"]["getEmbassyDetails"]>;

function EmbassyBody({ embassy }: { embassy: EmbassyDetails }) {
  const activeMissions = (embassy.missions ?? []).filter((m) => m.status === "active");
  return (
    <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
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
        {embassy.location && <InfoRow label="Location" value={embassy.location} icon={MapPin} />}
        <InfoRow label="Staff" value={`${embassy.staffCount ?? 0} personnel`} icon={Users} />
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

      <div>
        <SectionTitle icon={TrendingUp}>Performance</SectionTitle>
        <div className="space-y-2">
          <StatBar label="Effectiveness" value={embassy.effectiveness ?? 0} max={100} />
          <StatBar label="Influence" value={embassy.influence ?? 0} max={100} />
          <StatBar label="Reputation" value={embassy.reputation ?? 0} max={100} />
          <StatBar label="Experience" value={embassy.experience ?? 0} max={1000} />
        </div>
      </div>

      {activeMissions.length > 0 && (
        <>
          <Separator />
          <div>
            <SectionTitle icon={Zap}>Active Missions ({activeMissions.length})</SectionTitle>
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

      {embassy.specialization && (
        <>
          <Separator />
          <div>
            <SectionTitle icon={Star}>Specialization</SectionTitle>
            <Badge variant="default">{embassy.specialization}</Badge>
          </div>
        </>
      )}
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

  const { data: embassy, isLoading } = api.diplomaticEmbassies.getEmbassyDetails.useQuery(
    { embassyId: embassyId! },
    { enabled: !!embassyId }
  );

  const mutationOptions = (success: string, failure: string) => ({
    onSuccess: () => {
      notify.success(success);
      onEmbassyChanged?.();
      onClose();
    },
    onError: (error: { message: string }) => notify.error(`Failed to ${failure}: ${error.message}`),
  });
  const closeMutation = api.diplomaticEmbassies.closeEmbassy.useMutation(
    mutationOptions("Embassy closed.", "close embassy")
  );
  const reopenMutation = api.diplomaticEmbassies.reopenEmbassy.useMutation(
    mutationOptions("Embassy reopened.", "reopen embassy")
  );
  const severMutation = api.diplomaticEmbassies.deleteEmbassy.useMutation(
    mutationOptions("Diplomatic relations severed and embassy deleted.", "sever relations")
  );

  /** Footer actions by embassy status. */
  const actions = {
    active: [
      {
        label: "Close Embassy",
        pendingLabel: "Closing…",
        variant: "destructive",
        icon: XCircle,
        mutation: closeMutation,
      },
    ],
    closed: [
      {
        label: "Reopen Embassy",
        pendingLabel: "Reopening…",
        variant: "default",
        icon: CheckCircle,
        mutation: reopenMutation,
      },
      {
        label: "Sever Relations",
        pendingLabel: "Severing…",
        variant: "destructive",
        icon: XCircle,
        mutation: severMutation,
      },
    ],
  } as const;
  const statusActions = embassy ? (actions[embassy.status as keyof typeof actions] ?? []) : [];

  return (
    <Sheet
      open={embassyId !== null}
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
              <StatusBadge status={embassy.status} />
              <Badge variant="default">
                {LEVEL_LABELS[embassy.level ?? 1] ?? `Level ${embassy.level ?? 1}`}
              </Badge>
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
            <EmbassyBody embassy={embassy} />

            <SheetFooter className="border-separator border-t px-6 py-4">
              <Button variant="outline" size="sm" onClick={onClose}>
                Close
              </Button>
              {statusActions.map(({ label, pendingLabel, variant, icon: Icon, mutation }) => (
                <Button
                  key={label}
                  size="sm"
                  variant={variant}
                  className="gap-2"
                  onClick={() => mutation.mutate({ embassyId: embassy.id })}
                  disabled={mutation.isPending}
                >
                  <Icon className="h-3 w-3" />
                  {mutation.isPending ? pendingLabel : label}
                </Button>
              ))}
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
