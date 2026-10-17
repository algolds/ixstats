"use client";
/**
 * Suggest a wiki article that has no card yet. Suggestions are free, up to 3 a day, and wait in the cards admin's
 * Curation tab; an admin makes the card.
 */
import { useId, useState } from "react";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import {
  CARD_ARTICLE_SOURCES,
  cardSourceLabel,
  parseCardWikiSource,
  type CardArticleSource,
} from "~/lib/cards/card-sources";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { ArticleSearch } from "./ArticleSearch";

const STATUS_LABELS: ReadonlyMap<string, string> = new Map([
  ["PENDING", "Waiting"],
  // A paid request approved before suggestions were free, and not made yet: it waits like a suggestion.
  ["APPROVED", "Waiting"],
  ["GENERATED", "Made into a card"],
  ["REJECTED", "Declined"],
]);

const SOURCE_OPTIONS = CARD_ARTICLE_SOURCES.map((value) => ({
  value,
  label: cardSourceLabel(value),
}));

export function CardSuggestionForm() {
  const notify = useNotify();
  const utils = api.useUtils();
  const articleId = useId();
  const [source, setSource] = useState<CardArticleSource>("ixwiki");
  const [title, setTitle] = useState("");
  // Remounts the search field, so a sent suggestion or another wiki starts it empty.
  const [round, setRound] = useState(0);
  const restart = () => {
    setTitle("");
    setRound((count) => count + 1);
  };
  const mine = api.cards.mySuggestions.useQuery();
  const suggest = api.cards.suggestCard.useMutation({
    onSuccess: () => {
      notify.success("Suggestion sent", "An admin will review it.");
      restart();
      void utils.cards.mySuggestions.invalidate();
    },
    onError: (error) => notify.error("Suggestion not sent", error.message),
  });
  const suggestions = mine.data ?? [];

  return (
    <div className="space-y-6">
      <SegmentedControl
        fullWidth
        aria-label="Wiki"
        value={source}
        onValueChange={(value) => {
          setSource(value);
          restart();
        }}
        options={SOURCE_OPTIONS}
      />
      <div className="space-y-2">
        <Label htmlFor={articleId}>Article</Label>
        <ArticleSearch key={round} id={articleId} wikiSource={source} onSelect={setTitle} />
      </div>
      <div className="space-y-2">
        <Button
          size="lg"
          className="w-full"
          disabled={!title || suggest.isPending}
          onClick={() => suggest.mutate({ source, title })}
        >
          Suggest this article
        </Button>
        <p className="text-footnote text-label-secondary">
          Free. You can suggest 3 articles a day.
        </p>
      </div>
      {suggestions.length > 0 && (
        <ul className="space-y-2" aria-label="Your suggestions">
          {suggestions.map((suggestion) => {
            const wiki = parseCardWikiSource(suggestion.wikiSource);
            return (
              <li
                key={suggestion.id}
                className="bg-fill-3 rounded-row flex items-center justify-between gap-3 p-3"
              >
                <div className="min-w-0">
                  <p className="text-callout text-label truncate">{suggestion.articleTitle}</p>
                  <p className="text-footnote text-label-secondary">
                    {wiki ? cardSourceLabel(wiki) : suggestion.wikiSource}
                    {suggestion.rejectionReason ? ` · ${suggestion.rejectionReason}` : ""}
                  </p>
                </div>
                <Badge>{STATUS_LABELS.get(suggestion.status) ?? suggestion.status}</Badge>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
