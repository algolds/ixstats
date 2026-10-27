"use client";

import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { soundCues } from "~/lib/sound/cuelume";
import type { SelectionPayload } from "~/components/wiki-os/margin/SelectionCapsule";

/**
 * The article's Margin Markup annotations (loaded while `enabled`) and the Selection Capsule's
 * highlight and stash-quote actions. Split out of ArticleRenderer.tsx.
 */
export function useArticleAnnotations(title: string, enabled: boolean) {
  const utils = api.useUtils();
  const notify = useNotify();

  const { data: annotationsData, refetch: refetchAnnotations } = api.wikios.getAnnotations.useQuery(
    { pageTitle: title },
    { enabled, staleTime: 15_000 }
  );

  const addAnnotationMutation = api.wikios.addAnnotation.useMutation({
    onSuccess: () => {
      soundCues?.success?.();
      void utils.wikios.getAnnotations.invalidate({ pageTitle: title });
      void utils.wikios.getStashItems.invalidate();
      void utils.wikios.getStashes.invalidate();
      void refetchAnnotations();
    },
    onError: (err: { message?: string }) => {
      notify.error(err.message || "Failed to add highlight");
    },
  });

  const stashPageMutation = api.wikios.stashPage.useMutation({
    onSuccess: () => {
      void utils.wikios.isStashed.invalidate({ pageTitle: title });
      void utils.wikios.getStashes.invalidate();
      void utils.wikios.getStashItems.invalidate();
    },
    onError: (err: { message?: string }) => {
      notify.error(err.message || "Failed to stash page");
    },
  });

  const handleAddHighlight = (payload: SelectionPayload, color: string) => {
    addAnnotationMutation.mutate(
      {
        pageTitle: title,
        selectedText: payload.text,
        color,
      },
      {
        onSuccess: () => {
          notify.success("Highlight saved to Margin Markup");
        },
      }
    );
  };

  const handleStashQuote = (payload: SelectionPayload) => {
    addAnnotationMutation.mutate(
      {
        pageTitle: title,
        selectedText: payload.text,
        comment: "Saved quote",
        color: "#f472b6",
      },
      {
        onSuccess: () => {
          notify.success("Quote saved to Stash & Margin");
          stashPageMutation.mutate({ pageTitle: title });
        },
      }
    );
  };

  return { annotationsData, handleAddHighlight, handleStashQuote };
}
