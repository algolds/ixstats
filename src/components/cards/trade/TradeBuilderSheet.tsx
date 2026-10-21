"use client";

import { useEffect, useReducer, useRef, useState } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "~/components/ui/sheet";
import { Signal } from "~/components/ui/signal";
import {
  useFindPartner,
  useSeedCopy,
  useTradeDetails,
  useTradeMutations,
  type TradeDetailsView,
  type TradeableView,
} from "~/hooks/cards/useTradeBuilder";
import {
  builderReducer,
  builderTable,
  initialBuilderState,
  stateFromTrade,
  type TradeCopyLike,
} from "~/lib/cards/trade/builder-state";
import { validateTradeTable } from "~/lib/cards/trade/trade-table";
import { PartnerWishlist } from "./PartnerWishlist";
import { TradeCardPicker } from "./TradeCardPicker";
import { TradePartnerPicker } from "./TradePartnerPicker";
import { TradeSideColumn } from "./TradeSideColumn";
import { TradeSummary } from "./TradeSummary";

export interface TradeSeed {
  partnerHandle?: string;
  give?: string | string[];
  get?: string | string[];
}

interface TradeBuilderSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** An existing trade to review or counter; otherwise a new one. */
  tradeId?: string;
  seed?: TradeSeed;
}

const AUDIENCE_TEXT = {
  everyone: "takes offers from everyone",
  followers: "only takes offers from players who follow them",
  verified: "only takes offers from verified players",
  nobody: "isn't taking trade offers",
} as const;

/** Every copy the table may show: the open trade's copies plus each one picked since. */
function useKnownCopies(details: TradeDetailsView | undefined) {
  const [picked, setPicked] = useState<Map<string, TradeCopyLike>>(new Map());
  const remember = (copy: TradeCopyLike | TradeableView) =>
    setPicked((prev) => new Map(prev).set(copy.ownershipId, copy as TradeCopyLike));

  // The open trade's copies are read from its details, so only picks need state
  const onTable = new Map(
    details
      ? [...details.initiatorCopies, ...details.recipientCopies].map((copy) => [
          copy.ownershipId,
          copy,
        ])
      : []
  );
  const resolve = (ids: string[]) => ids.flatMap((id) => onTable.get(id) ?? picked.get(id) ?? []);
  return { resolve, remember };
}

/** The two-column trade table: build an offer, or review, answer and counter one. */
export function TradeBuilderSheet({ open, onOpenChange, tradeId, seed }: TradeBuilderSheetProps) {
  const initialGive = seed?.give ? (Array.isArray(seed.give) ? seed.give : [seed.give]) : [];
  const initialGet = seed?.get ? (Array.isArray(seed.get) ? seed.get : [seed.get]) : [];

  const [state, dispatch] = useReducer(
    builderReducer,
    { give: initialGive, get: initialGet },
    initialBuilderState
  );
  const [editing, setEditing] = useState(!tradeId);
  const [announcement, setAnnouncement] = useState("");
  const [failure, setFailure] = useState<{
    message: string;
    data?: { code: string } | null;
  } | null>(null);
  const [pickedPrivacy, setPickedPrivacy] = useState<{
    audience: "everyone" | "followers" | "verified" | "nobody";
    allowed: boolean;
    cardsShown?: boolean;
  } | null>(null);

  const { data: details } = useTradeDetails(tradeId ?? null);
  const partnerHandle = tradeId
    ? details
      ? details.viewerRole === "initiator"
        ? details.recipient.passportHandle
        : details.initiator.passportHandle
      : null
    : (seed?.partnerHandle ?? null);

  const { data: partnerData, isFetched: partnerFetched } = useFindPartner(partnerHandle);
  const { resolve, remember } = useKnownCopies(details);
  const mutations = useTradeMutations();

  const seedOwnershipId = initialGive[0] ?? null;
  const seedCopy = useSeedCopy(seedOwnershipId);
  const seedHandledRef = useRef(false);

  useEffect(() => {
    if (seedCopy && !seedHandledRef.current) {
      remember(seedCopy);
      seedHandledRef.current = true;
    } else if (seedCopy === null && !seedHandledRef.current && seedOwnershipId) {
      dispatch({ type: "drop", ownershipId: seedOwnershipId });
      seedHandledRef.current = true;
    }
  }, [seedCopy, seedOwnershipId, remember]);

  // Each new read of the trade resets the table to it, during render rather than in an effect
  const [loaded, setLoaded] = useState<TradeDetailsView | undefined>(undefined);
  if (details && details !== loaded) {
    setLoaded(details);
    dispatch({ type: "load", state: stateFromTrade(details, details.viewerRole) });
    setEditing(false);
  }

  useEffect(() => {
    if (seed?.partnerHandle && partnerData && !state.partner) {
      dispatch({
        type: "partner",
        partner: {
          id: partnerData.id,
          handle: partnerData.handle,
          displayName: partnerData.displayName,
        },
      });
    }
  }, [seed?.partnerHandle, partnerData, state.partner]);

  const privacy = partnerData?.privacy ?? pickedPrivacy ?? undefined;
  const closed = privacy !== undefined && !privacy.allowed;
  const cardsHidden = privacy?.cardsShown === false;
  const viewer = details?.viewerRole ?? "initiator";
  const table = builderTable(state, viewer);
  const problem = validateTradeTable(table);

  const close = () => onOpenChange(false);

  const pick = (side: "give" | "get") => (copy: TradeableView) => {
    remember(copy);
    const chosen = state[side].cardIds.includes(copy.ownershipId);
    const target = side === "give" ? "You give" : "You get";
    if (chosen) {
      setAnnouncement(`Removed ${copy.face.title} from ${target}.`);
    } else {
      setAnnouncement(`Added ${copy.face.title} to ${target}.`);
    }
    dispatch({ type: "toggle", side, ownershipId: copy.ownershipId });
  };

  const removeCard = (side: "give" | "get") => (id: string, targetToFocus?: HTMLElement | null) => {
    const copy = resolve([id])[0];
    const target = side === "give" ? "You give" : "You get";
    setAnnouncement(`Removed ${copy?.face.title ?? "card"} from ${target}.`);
    dispatch({ type: "toggle", side, ownershipId: id });
    targetToFocus?.focus();
  };

  const send = () => {
    if (!state.partner || problem) return;
    const message = state.message.trim() || undefined;
    setFailure(null);
    if (details) {
      mutations.counter.mutate(
        { tradeId: details.id, revision: details.revision, ...table, message },
        { onSuccess: close, onError: setFailure }
      );
    } else {
      mutations.create.mutate(
        { partnerId: state.partner.id, ...table, message },
        { onSuccess: close, onError: setFailure }
      );
    }
  };

  const sheetFrom = details?.myTurn ? { kind: "offer" as const, id: details.id } : null;
  const canBuild = state.partner !== null && !closed;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent size="wide" className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>
            {details ? `Trade with @${state.partner?.handle ?? ""}` : "New trade"}
          </SheetTitle>
        </SheetHeader>
        <div className="space-y-4 px-4 pb-4">
          <div aria-live="polite" className="sr-only">
            {announcement}
          </div>
          {failure && (
            <Signal tone="destructive" title="Trade error">
              {failure.message}
            </Signal>
          )}

          {!state.partner && !details && (
            <>
              {seed?.partnerHandle && partnerFetched && partnerData === null && (
                <p className="text-callout text-label-secondary">
                  No player goes by @{seed.partnerHandle}.
                </p>
              )}
              <TradePartnerPicker
                onPick={(p) => {
                  setPickedPrivacy(p.privacy);
                  dispatch({
                    type: "partner",
                    partner: { id: p.id, handle: p.handle, displayName: p.displayName },
                  });
                }}
              />
            </>
          )}

          {privacy && state.partner && (
            <div className="space-y-1">
              {closed ? (
                <Signal
                  tone="warning"
                  title={`@${state.partner.handle} ${AUDIENCE_TEXT[privacy.audience]}`}
                />
              ) : cardsHidden ? (
                <p className="text-footnote text-label-secondary">
                  @{state.partner.handle} keeps their cards private, so you can only ask for
                  credits.
                </p>
              ) : (
                <p className="text-footnote text-label-secondary">
                  @{state.partner.handle} {AUDIENCE_TEXT[privacy.audience]}.
                </p>
              )}
              {!details && (
                <Button
                  variant="link"
                  size="sm"
                  className="px-0"
                  onClick={() => {
                    setPickedPrivacy(null);
                    dispatch({ type: "partner", partner: null });
                  }}
                >
                  Change partner
                </Button>
              )}
            </div>
          )}

          {details?.message && !editing && (
            <p className="text-callout text-label-secondary italic">“{details.message}”</p>
          )}

          {canBuild && state.partner && (
            <>
              <div className="grid gap-6 md:grid-cols-2">
                <TradeSideColumn
                  title="You give"
                  copies={resolve(state.give.cardIds)}
                  credits={state.give.credits}
                  editable={editing}
                  reportable={false}
                  sheetFrom={null}
                  onRemove={removeCard("give")}
                  onCredits={(credits) => dispatch({ type: "credits", side: "give", credits })}
                />
                <TradeSideColumn
                  title="You get"
                  copies={resolve(state.get.cardIds)}
                  credits={state.get.credits}
                  editable={editing}
                  reportable
                  sheetFrom={sheetFrom}
                  onRemove={removeCard("get")}
                  onCredits={(credits) => dispatch({ type: "credits", side: "get", credits })}
                />
              </div>

              {editing && (
                <>
                  <div className="space-y-1">
                    <Label htmlFor="trade-note">A note for @{state.partner.handle}</Label>
                    <Input
                      id="trade-note"
                      placeholder="Optional note"
                      value={state.message}
                      onChange={(e) => dispatch({ type: "message", message: e.target.value })}
                    />
                  </div>

                  <div className="grid gap-6 md:grid-cols-2">
                    <TradeCardPicker
                      partnerId={state.partner.id}
                      side="mine"
                      selected={state.give.cardIds}
                      onToggle={pick("give")}
                    />
                    {!cardsHidden && (
                      <TradeCardPicker
                        partnerId={state.partner.id}
                        side="theirs"
                        selected={state.get.cardIds}
                        onToggle={pick("get")}
                      />
                    )}
                  </div>
                  {!cardsHidden && (
                    <PartnerWishlist partnerId={state.partner.id} handle={state.partner.handle} />
                  )}
                  <TradeSummary give={state.give} get={state.get} />
                </>
              )}
            </>
          )}
        </div>
        <SheetFooter>
          <BuilderActions
            details={details}
            editing={editing}
            canSend={canBuild}
            canCounter={!closed}
            problem={problem}
            mutations={mutations}
            hasCards={state.give.cardIds.length > 0 || state.get.cardIds.length > 0}
            onSend={send}
            onCounter={() => {
              setFailure(null);
              setEditing(true);
            }}
            onBack={() => {
              if (details) {
                dispatch({
                  type: "load",
                  state: stateFromTrade(details, details.viewerRole),
                });
              }
              setEditing(false);
            }}
            onClose={close}
            onClearFailure={() => setFailure(null)}
            onError={setFailure}
          />
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

interface BuilderActionsProps {
  details: TradeDetailsView | undefined;
  editing: boolean;
  canSend: boolean;
  canCounter: boolean;
  problem: string | null;
  mutations: ReturnType<typeof useTradeMutations>;
  hasCards: boolean;
  onSend: () => void;
  onCounter: () => void;
  onBack: () => void;
  onClose: () => void;
  onClearFailure: () => void;
  onError: (err: { message: string; data?: { code: string } | null }) => void;
}

/** Send or counter while editing; accept, counter or decline on your turn; withdraw your own pending offer. */
function BuilderActions({
  details,
  editing,
  canSend,
  canCounter,
  problem,
  mutations,
  hasCards,
  onSend,
  onCounter,
  onBack,
  onClose,
  onClearFailure,
  onError,
}: BuilderActionsProps) {
  if (editing) {
    if (!canSend) return null;
    return (
      <div className="flex w-full items-center justify-between gap-2">
        {details ? (
          <Button variant="secondary" onClick={onBack}>
            Back
          </Button>
        ) : (
          <span />
        )}
        <Button
          disabled={
            !hasCards || !!problem || mutations.create.isPending || mutations.counter.isPending
          }
          onClick={onSend}
        >
          {details ? "Send counter-offer" : "Send offer"}
        </Button>
      </div>
    );
  }

  if (!details) return null;

  if (details.status === "ACCEPTED") {
    return <p className="text-footnote text-label-secondary">This trade went through.</p>;
  }

  const isExpired =
    details.status === "EXPIRED" ||
    (details.expiresAt && new Date(details.expiresAt).getTime() < Date.now());

  if (details.status !== "PENDING" || isExpired) {
    return <p className="text-footnote text-label-secondary">This offer expired.</p>;
  }

  const answer = (action: "ACCEPT" | "REJECT") => {
    onClearFailure();
    mutations.respond.mutate(
      { tradeId: details.id, action, revision: details.revision },
      { onSuccess: onClose, onError }
    );
  };

  if (details.myTurn) {
    return (
      <div className="flex w-full items-center justify-end gap-2">
        <Button onClick={() => answer("ACCEPT")}>Accept</Button>
        {canCounter && (
          <Button variant="secondary" onClick={onCounter}>
            Counter
          </Button>
        )}
        <Button variant="ghost" onClick={() => answer("REJECT")}>
          Decline
        </Button>
      </div>
    );
  }

  return (
    <Button
      variant="ghost"
      onClick={() => mutations.cancel.mutate({ tradeId: details.id }, { onSuccess: onClose })}
    >
      Withdraw offer
    </Button>
  );
}
