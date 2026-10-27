import { type IntentCommitResult } from "~/components/mycountry/shared/primitives/IntentComposer";
import { DirectivesWorkspace } from "~/components/mycountry/directives/DirectivesWorkspace";
import type { DrillSheetKind } from "./DrillSheets";

/**
 * EXECUTIVE mode — the Directives page (`/mycountry/executive`).
 * Declare a directive (goal → approach → projected impact → review), track the ones in force,
 * and review past directives with the effects they recorded. See DirectivesWorkspace.
 */
interface ExecutiveConsoleProps {
  countryId: string;
  initialGoal?: string;
  onDone?: (msg?: string) => void;
  onCommitted?: (res: IntentCommitResult) => void;
  /** Opens a MyCountry drill sheet (a directive record or a resistance issue brief). */
  onOpenDrill?: (drill: DrillSheetKind) => void;
}

export function ExecutiveConsole({
  countryId,
  initialGoal,
  onDone,
  onCommitted,
  onOpenDrill,
}: ExecutiveConsoleProps) {
  return (
    <DirectivesWorkspace
      countryId={countryId}
      initialGoal={initialGoal}
      onCommitted={(res) => {
        onCommitted?.(res);
        onDone?.(res?.summary ?? "Directive committed.");
      }}
      onOpenIntent={
        onOpenDrill ? (intentId) => onOpenDrill({ kind: "intent", intentId }) : undefined
      }
      onOpenIssue={onOpenDrill ? (issueId) => onOpenDrill({ kind: "issue", issueId }) : undefined}
    />
  );
}
