"use client";

import { useState } from "react";
import {
  OpenBook as BookOpen,
  SystemRestart as Loader2,
  UserBadgeCheck as UserCheck,
  WarningCircle as AlertCircle,
} from "iconoir-react";
import { api } from "~/trpc/react";
import { cn } from "~/lib/utils";
import { useNotify } from "~/hooks/useNotify";
import { IIWikiBadge } from "~/components/cards/display/IIWikiLogo";
import { Badge, type BadgeVariant } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";

type RequestStatus = "PENDING" | "APPROVED" | "GENERATED" | "REJECTED";

const STATUS_BADGES: Record<RequestStatus, { label: string; variant: BadgeVariant }> = {
  PENDING: { label: "Pending", variant: "warning" },
  APPROVED: { label: "Approved", variant: "info" },
  GENERATED: { label: "Generated", variant: "success" },
  REJECTED: { label: "Rejected", variant: "destructive" },
};

const FILTER_OPTIONS = [
  ["ALL", "All requests"],
  ["PENDING", "Pending only"],
  ["APPROVED", "Approved only"],
  ["GENERATED", "Generated only"],
  ["REJECTED", "Rejected only"],
] as const;

const COLUMNS = [
  ["Article title", "px-4"],
  ["Wiki source", "px-4"],
  ["Requester (Nation / User)", "px-4"],
  ["Requested date", "px-4"],
  ["Status", "px-4"],
  ["Actions", "px-4 text-right"],
] as const;

const STAT_CARDS = [
  { key: "total", label: "Total requests", card: "", value: "text-label" },
  {
    key: "pending",
    label: "Pending approval",
    card: "border-yellow/30 bg-yellow/10",
    value: "text-yellow",
  },
  {
    key: "generated",
    label: "Generated cards",
    card: "border-green/30 bg-green/10",
    value: "text-green",
  },
  { key: "rejected", label: "Rejected", card: "border-red/30 bg-red/10", value: "text-red" },
] as const;

/** The user lore-card request queue: approve, reject with a refund, or mint a requested card. */
export function RequestQueueTab() {
  const notify = useNotify();
  const utils = api.useUtils();
  const [statusFilter, setStatusFilter] = useState<"ALL" | RequestStatus>("ALL");
  const [rejectionRequestId, setRejectionRequestId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  const stats = api.loreCards.getRequestStats.useQuery();
  const queue = api.loreCards.getRequestQueue.useQuery({
    status: statusFilter === "ALL" ? undefined : statusFilter,
    limit: 50,
  });

  const refresh = () => {
    void utils.loreCards.getRequestQueue.invalidate();
    void utils.loreCards.getRequestStats.invalidate();
  };

  const approveMutation = api.loreCards.approveRequest.useMutation({
    onSuccess: (data) => {
      notify.success("Request Approved", data.message || "Request approved.");
      refresh();
    },
    onError: (err) => notify.error("Approval Error", err.message),
  });
  const rejectMutation = api.loreCards.rejectRequest.useMutation({
    onSuccess: (data) => {
      notify.info("Request Rejected", data.message || "Request rejected and user refunded.");
      setRejectionRequestId(null);
      setRejectionReason("");
      refresh();
    },
    onError: (err) => notify.error("Rejection Error", err.message),
  });
  const mintMutation = api.loreCards.generateRequestedCard.useMutation({
    onSuccess: (data) => {
      notify.success("Lore Card Minted", data.message || "Lore card generated successfully.");
      refresh();
    },
    onError: (err) => notify.error("Generation Error", err.message),
  });

  const requests = queue.data?.requests ?? [];

  return (
    <div className="space-y-6">
      {stats.data && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {STAT_CARDS.map(({ key, label, card, value }) => (
            <Card key={key} className={cn("rounded-row p-3", card)}>
              <div className="text-label-secondary text-footnote">{label}</div>
              <div className={cn("text-title-3 mt-0.5", value)}>{stats.data[key]}</div>
            </Card>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2">
        <span className="text-label-secondary text-caption">Filter Queue:</span>
        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}
        >
          <SelectTrigger size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FILTER_OPTIONS.map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {queue.isLoading ? (
        <div className="border-separator bg-surface rounded-row flex h-48 items-center justify-center border">
          <Loader2 className="text-tint h-6 w-6 animate-spin" />
        </div>
      ) : requests.length === 0 ? (
        <div className="border-separator bg-surface rounded-row flex h-40 flex-col items-center justify-center border border-dashed">
          <BookOpen className="text-label-tertiary mb-2 h-8 w-8" />
          <p className="text-label text-headline">No requests found in queue</p>
        </div>
      ) : (
        <Card className="overflow-hidden">
          <Table containerClassName="max-h-[500px]">
            <TableHeader sticky>
              <TableRow>
                {COLUMNS.map(([name, className]) => (
                  <TableHead key={name} className={className}>
                    {name}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.map((request) => {
                const badge = STATUS_BADGES[request.status as RequestStatus];
                const isPending = request.status === "PENDING";
                return (
                  <TableRow key={request.id}>
                    <TableCell className="text-label px-4 font-semibold">
                      {request.articleTitle}
                    </TableCell>
                    <TableCell className="px-4">
                      {request.wikiSource === "iiwiki" ? (
                        <IIWikiBadge size="xs" />
                      ) : (
                        <Badge variant="default">{request.wikiSource}</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-label px-4 font-medium">
                      <Badge variant="secondary" className="gap-2">
                        <UserCheck className="h-3 w-3" />
                        {request.requesterName || request.userId}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-label-secondary px-4">
                      {new Date(request.requestedAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="px-4">
                      {badge && <Badge variant={badge.variant}>{badge.label}</Badge>}
                    </TableCell>
                    <TableCell className="px-4 text-right">
                      <div className="flex justify-end gap-2">
                        {isPending && (
                          <>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => approveMutation.mutate({ requestId: request.id })}
                              disabled={approveMutation.isPending}
                            >
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => setRejectionRequestId(request.id)}
                            >
                              Reject
                            </Button>
                          </>
                        )}
                        {(isPending || request.status === "APPROVED") && (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => mintMutation.mutate({ requestId: request.id })}
                            disabled={mintMutation.isPending}
                          >
                            Mint card
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      <Dialog
        open={rejectionRequestId !== null}
        onOpenChange={(open) => !open && setRejectionRequestId(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="text-red h-5 w-5" />
              Reject Lore Card Request & Refund 50 IxC?
            </DialogTitle>
            <DialogDescription>
              Provide an optional reason for the user. The 50 IxC request fee will be automatically
              refunded to their vault.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            placeholder="Reason for rejection (e.g. Article non-existent or duplicate)"
            className="rounded-control-sm md:text-footnote h-(--control-height-sm)"
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRejectionRequestId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() =>
                rejectionRequestId &&
                rejectMutation.mutate({
                  requestId: rejectionRequestId,
                  reason: rejectionReason || undefined,
                })
              }
              disabled={rejectMutation.isPending}
            >
              {rejectMutation.isPending ? "Rejecting..." : "Confirm Rejection"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
