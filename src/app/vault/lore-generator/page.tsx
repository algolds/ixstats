"use client";
/** Suggest a lore card: a free suggestion for an article with no card yet. */
import { PageHeader } from "~/components/shell/PageHeader";
import { Card } from "~/components/ui/card";
import { CardSuggestionForm } from "~/components/cards/suggest/CardSuggestionForm";

export default function SuggestLoreCardPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Suggest a lore card"
        subtitle="Pick a wiki article with no card yet. An admin reviews every suggestion."
      />
      <Card content="input" padding="lg">
        <CardSuggestionForm />
      </Card>
    </div>
  );
}
