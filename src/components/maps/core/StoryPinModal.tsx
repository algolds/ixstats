"use client";

import { Skeleton } from "~/components/ui/skeleton";
import { memo, type ComponentProps } from "react";
import {
  OpenBook as BookOpen,
  OpenNewWindow as ExternalLink,
  MapPin,
  NavArrowRight as ChevronRight,
  NavArrowLeft as ChevronLeft,
  Eye,
} from "iconoir-react";
import Link from "next/link";
import dynamic from "next/dynamic";
import remarkGfm from "remark-gfm";

import { STORY_PIN_COLORS } from "~/lib/maps/story-pin-icons";
import { TimelineEraBadge } from "~/components/maps/shared/TimelineEraBadge";

import { useStoryPinModalState } from "~/components/maps/core/hooks/useStoryPinModalState";
import { StoryPinLightbox } from "~/components/maps/core/components/StoryPinLightbox";
import { StorylineTimeline } from "~/components/maps/core/components/StorylineTimeline";
import { RelatedPinCard } from "~/components/maps/core/components/RelatedPinCard";
import { getCategoryIcon, IMPORTANCE_LABELS } from "~/components/maps/core/utils/story-pin-helpers";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "~/components/ui/sheet";
import { Eyebrow } from "~/components/ui/eyebrow";
import { FACET_PROSE } from "~/components/maps/shared/facet-prose";
import { cn } from "~/lib/utils/cn";
import { Card } from "~/components/ui/card";

const ReactMarkdown = dynamic(() => import("react-markdown"), { ssr: false });

type StoryPinData = NonNullable<ReturnType<typeof useStoryPinModalState>["data"]>;
type StoryPin = NonNullable<StoryPinData["pin"]>;
type WikiEnrichment = StoryPinData["wikiEnrichment"];

interface StoryPinModalProps {
  pinId: string;
  onClose: () => void;
  onFlyTo?: (lng: number, lat: number) => void;
  onNavigateToPin?: (pinId: string) => void;
}

const PHOTO_BUTTON_CLASS =
  "border-separator rounded-control shrink-0 overflow-hidden border transition-transform hover:scale-105";

/** Wiki article link: in-app `Link` for internal pages, a new-tab anchor otherwise. */
function WikiLinkButton({
  url,
  internal,
  externalIcon,
  children,
  ...buttonProps
}: ComponentProps<typeof Button> & {
  url: string;
  internal: boolean;
  externalIcon?: boolean;
}) {
  return (
    <Button asChild {...buttonProps}>
      {internal ? (
        <Link href={url}>{children}</Link>
      ) : (
        <a href={url} target="_blank" rel="noopener noreferrer">
          {children}
          {externalIcon && <ExternalLink aria-hidden />}
        </a>
      )}
    </Button>
  );
}

function StoryPinContent({ pin }: { pin: StoryPin }) {
  return (
    <div className={cn(FACET_PROSE, "prose-sm prose-p:text-label prose-img:rounded-control")}>
      {pin.contentFormat === "markdown" ? (
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{pin.content}</ReactMarkdown>
      ) : (
        pin.content?.split("\n\n").map((para, i) => <p key={i}>{para}</p>)
      )}
    </div>
  );
}

function StoryGallery({
  title,
  photos,
  wikiImages,
  onOpen,
}: {
  title: string;
  photos: string[];
  wikiImages: NonNullable<NonNullable<WikiEnrichment>["images"]>;
  onOpen: (src: string) => void;
}) {
  const items = [
    ...photos.map((url, i) => ({
      key: `photo-${i}`,
      src: url,
      thumb: url,
      alt: `${title} image ${i + 1}`,
    })),
    ...wikiImages.slice(0, 8).map((img, i) => ({
      key: `wiki-${i}`,
      src: img.url,
      thumb: img.thumbUrl || img.url,
      alt: img.title,
    })),
  ];
  return (
    <div>
      <Eyebrow className="mb-2 flex items-center gap-1">
        <Eye className="h-3 w-3" aria-hidden /> Gallery
      </Eyebrow>
      <div className="flex gap-2 overflow-x-auto pb-2">
        {items.map((item) => (
          <button
            type="button"
            key={item.key}
            onClick={() => onOpen(item.src)}
            className={PHOTO_BUTTON_CLASS}
          >
            <img src={item.thumb} alt={item.alt} className="h-24 w-32 object-cover" />
          </button>
        ))}
      </div>
    </div>
  );
}

function StoryPinHeader({
  pin,
  heroImage,
}: {
  pin: StoryPin;
  heroImage: string | null | undefined;
}) {
  const { category, storyline } = pin;
  // Category colour is map data (it matches the pin drawn on the map).
  const color = STORY_PIN_COLORS[category];
  const CategoryIcon = getCategoryIcon(category);
  const hasStoryline = storyline && storyline.pins.length > 1;

  return (
    <div className="shrink-0">
      {heroImage && (
        <div className="h-48 w-full overflow-hidden sm:h-56">
          <img src={heroImage} alt={pin.title} className="h-full w-full object-cover" />
        </div>
      )}

      <div className="px-5 pt-4 pr-12 pb-4">
        <div className="mb-2 flex items-center gap-2">
          <Badge variant="outline" className="capitalize">
            <CategoryIcon style={color ? { color } : undefined} aria-hidden />
            {category}
          </Badge>
          {pin.importance >= 1 && (
            <Badge variant="warning">{IMPORTANCE_LABELS[pin.importance]}</Badge>
          )}
        </div>
        <SheetTitle className="text-title-2 sm:text-title-1">{pin.title}</SheetTitle>
        <div className="text-footnote mt-1 flex flex-wrap items-center gap-2">
          <span className="text-label-secondary">{pin.country.name}</span>
          {(pin.ixTimeYear != null || pin.eraLabel) && (
            <TimelineEraBadge
              eraLabel={pin.eraLabel ?? undefined}
              ixTimeYear={pin.ixTimeYear ?? undefined}
              category={category}
            />
          )}
        </div>
        {hasStoryline && (
          <p className="text-label-secondary text-footnote mt-1">
            {storyline.title} · Event {storyline.pins.findIndex((p) => p.id === pin.id) + 1} of{" "}
            {storyline.pins.length}
          </p>
        )}
      </div>
    </div>
  );
}

function WikiIntroCard({
  intro,
  wikiUrl,
  internal,
}: {
  intro: string;
  wikiUrl: string | null | undefined;
  internal: boolean;
}) {
  return (
    <Card variant="inset" className="p-4">
      <Eyebrow className="mb-2 flex items-center gap-2">
        <BookOpen className="h-3.5 w-3.5" aria-hidden />
        From IxWiki
      </Eyebrow>
      <p className="text-label text-footnote leading-relaxed">{intro}</p>
      {wikiUrl && (
        <WikiLinkButton
          url={wikiUrl}
          internal={internal}
          externalIcon
          variant="link"
          size="xs"
          className="mt-1 px-0"
        >
          Read full article
        </WikiLinkButton>
      )}
    </Card>
  );
}

function StoryPinSidebar({
  storyline,
  pinId,
  relatedPins,
  onNavigate,
}: {
  storyline: StoryPin["storyline"] | null;
  pinId: string;
  relatedPins: StoryPinData["relatedPins"];
  onNavigate: (pinId: string) => void;
}) {
  return (
    <div className="w-full space-y-4 lg:w-60 lg:shrink-0">
      {storyline && (
        <StorylineTimeline
          pins={storyline.pins}
          currentPinId={pinId}
          storylineTitle={storyline.title}
          storylineColor={storyline.color}
          onNavigate={onNavigate}
        />
      )}

      {relatedPins && relatedPins.length > 0 && (
        <div>
          <Eyebrow className="mb-2 block">Related events</Eyebrow>
          <div className="space-y-2">
            {relatedPins.slice(0, 5).map((rp) => (
              <RelatedPinCard key={rp.id} pin={rp} onNavigate={onNavigate} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StoryPinFooter({
  pin,
  wikiUrl,
  wikiIsInternal,
  storylineIdx,
  storylineLength,
  onFlyTo,
  onGoToStorylinePin,
}: {
  pin: StoryPin;
  wikiUrl: string | null | undefined;
  wikiIsInternal: boolean;
  /** Index of this pin within a multi-pin storyline, -1 when it has none. */
  storylineIdx: number;
  /** Pin count of a multi-pin storyline, 0 when it has none. */
  storylineLength: number;
  onFlyTo: () => void;
  onGoToStorylinePin: (offset: number) => void;
}) {
  return (
    <div className="border-separator flex shrink-0 flex-wrap items-center gap-2 border-t px-5 py-3">
      {wikiUrl && (
        <WikiLinkButton url={wikiUrl} internal={wikiIsInternal} variant="outline" size="sm">
          <BookOpen aria-hidden />
          Read on IxWiki
        </WikiLinkButton>
      )}
      {pin.country.slug && (
        <Button asChild variant="outline" size="sm">
          <Link href={`/countries/${pin.country.slug}`}>
            View {pin.country.name}
            <ExternalLink aria-hidden />
          </Link>
        </Button>
      )}
      <Button size="sm" onClick={onFlyTo} className="bg-blue text-on-blue hover:bg-blue/90">
        <MapPin aria-hidden />
        Fly to location
      </Button>
      {storylineIdx > 0 && (
        <Button variant="secondary" size="sm" onClick={() => onGoToStorylinePin(-1)}>
          <ChevronLeft aria-hidden />
          Previous
        </Button>
      )}
      {storylineLength > 0 && storylineIdx < storylineLength - 1 && (
        <Button variant="secondary" size="sm" onClick={() => onGoToStorylinePin(1)}>
          Next
          <ChevronRight aria-hidden />
        </Button>
      )}
    </div>
  );
}

/** Flatten the fetched pin into the values the modal renders. */
function getStoryPinView(pin: StoryPin, data: StoryPinData) {
  const { wikiEnrichment, relatedPins } = data;
  const photos = (pin.photos as string[] | null) ?? [];
  const wikiUrl = wikiEnrichment?.wikiUrl;
  // Only multi-pin storylines get a timeline and previous/next navigation.
  const storyline = pin.storyline && pin.storyline.pins.length > 1 ? pin.storyline : null;
  return {
    pin,
    wikiEnrichment,
    relatedPins,
    photos,
    wikiImages: wikiEnrichment?.images ?? [],
    wikiUrl,
    wikiIsInternal: !!wikiUrl && (wikiUrl.startsWith("/") || wikiUrl.includes("/wiki/")),
    heroImage: pin.thumbnailUrl ?? wikiEnrichment?.thumbnailUrl ?? photos[0],
    storyline,
    storylineIdx: storyline ? storyline.pins.findIndex((p) => p.id === pin.id) : -1,
  };
}

export const StoryPinModal = memo(function StoryPinModal({
  pinId,
  onClose,
  onFlyTo,
  onNavigateToPin,
}: StoryPinModalProps) {
  const state = useStoryPinModalState({ pinId, onClose, onFlyTo, onNavigateToPin });
  const handleOpenChange = (open: boolean) => !open && onClose();

  if (state.isLoading) {
    return (
      <Sheet open onOpenChange={handleOpenChange}>
        <SheetContent size="wide" className="overflow-y-auto p-8">
          <SheetTitle className="sr-only">Loading story</SheetTitle>
          <Skeleton className="rounded-control-sm h-6 w-48" />
          <div className="mt-2 space-y-3">
            <Skeleton className="rounded-row h-40 w-full" />
            <Skeleton className="h-4 w-3/4 rounded-xs" />
            <Skeleton className="h-4 w-1/2 rounded-xs" />
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  if (!state.data?.pin) return null;
  const view = getStoryPinView(state.data.pin, state.data);

  const { pin, wikiEnrichment, relatedPins, photos, wikiImages, wikiUrl, wikiIsInternal } = view;
  const { storyline, storylineIdx } = view;
  const goToStorylinePin = (offset: number) =>
    state.handleNavigatePin(storyline!.pins[storylineIdx + offset]!.id);

  return (
    <>
      {state.lightboxSrc && (
        <StoryPinLightbox
          src={state.lightboxSrc}
          alt="Story pin image"
          onClose={() => state.setLightboxSrc(null)}
        />
      )}

      <Sheet open onOpenChange={handleOpenChange}>
        <SheetContent size="wide" className="flex flex-col gap-0 overflow-hidden p-0">
          <StoryPinHeader pin={pin} heroImage={view.heroImage} />

          <div className="border-separator min-h-0 flex-1 overflow-y-auto border-t">
            <div className="flex flex-col gap-6 p-5 lg:flex-row">
              <div className="min-w-0 flex-1 space-y-5">
                {pin.content && <StoryPinContent pin={pin} />}

                {wikiEnrichment?.intro && (
                  <WikiIntroCard
                    intro={wikiEnrichment.intro}
                    wikiUrl={wikiUrl}
                    internal={wikiIsInternal}
                  />
                )}

                {(photos.length > 0 || wikiImages.length > 0) && (
                  <StoryGallery
                    title={pin.title}
                    photos={photos}
                    wikiImages={wikiImages}
                    onOpen={state.setLightboxSrc}
                  />
                )}
              </div>

              <StoryPinSidebar
                storyline={storyline}
                pinId={pin.id}
                relatedPins={relatedPins}
                onNavigate={state.handleNavigatePin}
              />
            </div>
          </div>

          <StoryPinFooter
            pin={pin}
            wikiUrl={wikiUrl}
            wikiIsInternal={wikiIsInternal}
            storylineIdx={storylineIdx}
            storylineLength={storyline?.pins.length ?? 0}
            onFlyTo={state.handleFlyTo}
            onGoToStorylinePin={goToStorylinePin}
          />
        </SheetContent>
      </Sheet>
    </>
  );
});
