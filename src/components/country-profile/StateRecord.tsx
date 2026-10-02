import { CheckCircle, Page } from "iconoir-react";
import { Badge } from "~/components/ui/badge";
import { FacetListSection, FacetRow } from "~/components/ui/facet-list";
import { Progress } from "~/components/ui/progress";
import type {
  PublicDirective,
  PublicIssueOutcome,
} from "~/app/countries/[slug]/_utils/profileLayer";
import { formatIxDate } from "~/app/countries/[slug]/_utils/profileLayer";
import { categoryLabel, tierMeta } from "./labels";

/**
 * DirectiveRows — enacted directives (public record: in force or completed), newest first.
 * Drafts never arrive here; the layer filters them out.
 */
export function DirectiveRows({
  directives,
  header = "Directives in the public record",
  limit,
  footer,
}: {
  directives: readonly PublicDirective[];
  header?: React.ReactNode;
  limit?: number;
  footer?: React.ReactNode;
}) {
  const shown = limit ? directives.slice(0, limit) : directives;
  if (shown.length === 0) return null;
  return (
    <FacetListSection header={header} footer={footer}>
      {shown.map((d) => (
        <FacetRow
          key={d.id}
          leading={<Page aria-hidden className="text-label-secondary size-4" />}
          title={d.goal}
          subtitle={
            <span className="flex flex-col gap-2">
              <span>
                {categoryLabel(d.category)} · {tierMeta(d.tier).label} ·{" "}
                {formatIxDate(d.createdIxTime)}
              </span>
              {d.status === "active" && (
                <Progress
                  value={d.progress}
                  aria-label={`${d.goal}: ${d.progress}% complete`}
                  className="h-1 max-w-48"
                />
              )}
            </span>
          }
          trailing={
            <Badge variant={d.status === "completed" ? "success" : "secondary"}>
              {d.status === "completed" ? "Completed" : "In force"}
            </Badge>
          }
        />
      ))}
    </FacetListSection>
  );
}

/**
 * IssueOutcomeRows — resolved national issues with the decision taken and what followed.
 * Open, expired and dismissed issues never arrive here.
 */
export function IssueOutcomeRows({
  outcomes,
  header = "Decisions on national issues",
  limit,
  footer,
}: {
  outcomes: readonly PublicIssueOutcome[];
  header?: React.ReactNode;
  limit?: number;
  footer?: React.ReactNode;
}) {
  const shown = limit ? outcomes.slice(0, limit) : outcomes;
  if (shown.length === 0) return null;
  return (
    <FacetListSection header={header} footer={footer}>
      {shown.map((o) => (
        <FacetRow
          key={o.id}
          leading={<CheckCircle aria-hidden className="text-label-secondary size-4" />}
          title={o.title}
          subtitle={
            <span className="flex flex-col gap-0.5">
              {o.decision && (
                <span className="text-label">
                  {o.resolvedBy === "government" ? "Chose: " : "Lapsed to: "}
                  {o.decision}
                </span>
              )}
              {o.outcome && <span>{o.outcome}</span>}
              {o.ixTime != null && <span className="tabular-nums">{formatIxDate(o.ixTime)}</span>}
            </span>
          }
          trailing={<Badge variant="default">{o.domain}</Badge>}
        />
      ))}
    </FacetListSection>
  );
}
