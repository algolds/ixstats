"use client";
import React, { useEffect, useRef, useState, createContext, useContext } from "react";
import { createPortal } from "react-dom";
import {
  ArrowLeft as IconArrowNarrowLeft,
  ArrowRight as IconArrowNarrowRight,
  Xmark as IconX,
} from "iconoir-react";
import { cn } from "~/lib/utils/cn";
import { Button } from "~/components/ui/button";
import { AnimatePresence, motion } from "motion/react";
import Image, { type ImageProps } from "next/image";
import { useOutsideClick } from "~/hooks/use-outside-click";
import { withBasePath } from "~/lib/base-path";

interface CarouselProps {
  items: React.ReactElement[];
  initialScroll?: number;
}

type Card = {
  src: string;
  title: string;
  category: React.ReactNode;
  content: React.ReactNode;
  logo?: string;
  description?: React.ReactNode;
  footer?: React.ReactNode;
  quickActions?: React.ReactNode;
};

const CarouselContext = createContext<{
  onCardClose: (index: number) => void;
  currentIndex: number;
}>({
  onCardClose: () => {},
  currentIndex: 0,
});

export const Carousel = ({ items, initialScroll = 0 }: CarouselProps) => {
  const carouselRef = React.useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = React.useState(false);
  const [canScrollRight, setCanScrollRight] = React.useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (carouselRef.current) {
      carouselRef.current.scrollLeft = initialScroll;
      checkScrollability();
    }
    // oxlint-disable-next-line
  }, [initialScroll]);

  const checkScrollability = () => {
    if (carouselRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = carouselRef.current;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth);
    }
  };

  const scrollLeft = () => {
    if (carouselRef.current) {
      carouselRef.current.scrollBy({ left: -300, behavior: "smooth" });
    }
  };

  const scrollRight = () => {
    if (carouselRef.current) {
      carouselRef.current.scrollBy({ left: 300, behavior: "smooth" });
    }
  };

  const handleCardClose = (index: number) => {
    if (carouselRef.current) {
      const cardWidth = isMobile() ? 230 : 384; // (md:w-96)
      const gap = isMobile() ? 4 : 8;
      const scrollPosition = (cardWidth + gap) * (index + 1);
      carouselRef.current.scrollTo({
        left: scrollPosition,
        behavior: "smooth",
      });
      setCurrentIndex(index);
    }
  };

  const isMobile = () => {
    return window && window.innerWidth < 768;
  };

  return (
    <CarouselContext.Provider value={{ onCardClose: handleCardClose, currentIndex }}>
      <div className="relative w-full">
        <div
          className="flex w-full [scrollbar-width:none] overflow-x-scroll overscroll-x-auto scroll-smooth py-10 md:py-20"
          ref={carouselRef}
          onScroll={checkScrollability}
        >
          <div
            className={cn(
              "flex flex-row justify-start gap-4 pl-4",
              "mx-auto max-w-7xl" // remove max-w-4xl if you want the carousel to span the full width of its container
            )}
          >
            {items.map((item, index) => (
              <motion.div
                initial={{
                  opacity: 0,
                  y: 20,
                }}
                animate={{
                  opacity: 1,
                  y: 0,
                  transition: {
                    duration: 0.5,
                    delay: 0.2 * index,
                    ease: "easeOut",
                  },
                }}
                key={"card" + index}
                className="rounded-sheet last:pr-[5%] md:last:pr-[33%]"
              >
                {item}
              </motion.div>
            ))}
          </div>
        </div>
        <div className="mr-10 flex justify-end gap-2">
          <Button
            type="button"
            variant="secondary"
            size="icon-lg"
            className="relative rounded-full"
            onClick={scrollLeft}
            disabled={!canScrollLeft}
            aria-label="Scroll left"
          >
            <IconArrowNarrowLeft aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="icon-lg"
            className="relative rounded-full"
            onClick={scrollRight}
            disabled={!canScrollRight}
            aria-label="Scroll right"
          >
            <IconArrowNarrowRight aria-hidden="true" />
          </Button>
        </div>
      </div>
    </CarouselContext.Provider>
  );
};

export const Card = ({
  card,
  index,
  layout = false,
}: {
  card: Card;
  index: number;
  layout?: boolean;
}) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  // oxlint-disable-next-line eslint/no-unused-vars
  const { onCardClose, currentIndex } = useContext(CarouselContext);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        handleClose();
      }
    }

    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "auto";
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useOutsideClick(containerRef as any, () => handleClose());

  const handleOpen = () => {
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    onCardClose(index);
  };

  const modalContent = (
    <AnimatePresence>
      {open && (
        <div className="z-sheet fixed inset-0 h-screen overflow-auto">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="bg-scrim fixed inset-0 h-full w-full"
          />
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            ref={containerRef}
            layoutId={layout ? `card-${card.title}` : undefined}
            className="rounded-sheet bg-surface-elevated text-label shadow-sheet z-raised relative mx-auto my-10 h-fit max-w-5xl overflow-hidden p-4 md:p-10"
          >
            {/* Modal Background Image with Fade Overlay */}
            {card.src && (
              <div className="pointer-events-none absolute inset-0 -z-10 h-full w-full overflow-hidden">
                <img
                  src={withBasePath(card.src)}
                  alt=""
                  className="h-full w-full object-cover opacity-15 blur-[2px]"
                />
                <div className="bg-surface-elevated/80 absolute inset-0" />
              </div>
            )}
            <Button
              type="button"
              variant="secondary"
              size="icon-sm"
              className="sticky top-4 right-0 ml-auto flex rounded-full"
              onClick={handleClose}
              aria-label="Close"
            >
              <IconX aria-hidden="true" />
            </Button>
            <motion.div
              layoutId={layout ? `category-${card.title}` : undefined}
              className="text-headline text-label-secondary"
            >
              {card.category}
            </motion.div>
            <motion.div
              layoutId={layout ? `title-${card.title}` : undefined}
              className="text-title-1 md:text-large-title text-label mt-4 flex items-center gap-3"
            >
              {card.logo && (
                <img
                  src={withBasePath(card.logo)}
                  alt=""
                  className="rounded-row border-separator h-10 w-10 shrink-0 border object-cover md:h-14 md:w-14"
                />
              )}
              <span>{card.title}</span>
            </motion.div>
            {card.description && <div className="mt-2 text-left">{card.description}</div>}
            {card.footer && (
              <div className="border-separator mt-4 border-t pt-4 text-left">{card.footer}</div>
            )}
            <div className="py-10">{card.content}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );

  return (
    <>
      {mounted && typeof document !== "undefined"
        ? createPortal(modalContent, document.body)
        : null}
      <motion.div
        layoutId={layout ? `card-${card.title}` : undefined}
        onClick={handleOpen}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            handleOpen();
          }
        }}
        className="rounded-sheet bg-surface-secondary focus-visible:outline-tint relative z-10 flex h-80 w-56 cursor-pointer flex-col items-stretch justify-start overflow-hidden outline-none focus-visible:outline-2 focus-visible:outline-offset-2 md:h-[40rem] md:w-96"
      >
        {/* Flat image scrim so the white title reads on any photo */}
        <div className="pointer-events-none absolute inset-0 z-30 bg-black/35" />
        <div className="relative z-40 flex h-full w-full flex-col items-start justify-between p-8">
          <div className="flex flex-col items-start">
            <motion.div
              layoutId={layout ? `category-${card.title}` : undefined}
              className="text-subhead md:text-headline text-left font-medium text-white"
            >
              {card.category}
            </motion.div>
            <motion.div
              layoutId={layout ? `title-${card.title}` : undefined}
              className="text-title-3 md:text-title-1 mt-2 flex max-w-xs items-center gap-2 text-left [text-wrap:balance] text-white"
            >
              {card.logo && (
                <img
                  src={withBasePath(card.logo)}
                  alt=""
                  className="rounded-control-sm h-7 w-7 shrink-0 border border-white/20 object-cover md:h-9 md:w-9"
                />
              )}
              <span>{card.title}</span>
            </motion.div>
            {card.description && <div className="mt-2 text-left">{card.description}</div>}
          </div>
          {card.footer && <div className="mt-auto w-full">{card.footer}</div>}
        </div>
        <BlurImage
          src={card.src}
          alt={card.title}
          fill
          className="absolute inset-0 z-10 object-cover"
        />
      </motion.div>
    </>
  );
};

const BlurImage = ({ height, width, src, className, alt, ...rest }: ImageProps) => {
  const [isLoading, setLoading] = useState(true);
  return (
    <Image
      className={cn(
        "h-full w-full transition duration-300",
        isLoading ? "blur-sm" : "blur-0",
        className
      )}
      onLoad={() => setLoading(false)}
      src={src}
      width={width}
      height={height}
      loading="lazy"
      decoding="async"
      blurDataURL={typeof src === "string" ? src : undefined}
      alt={alt ? alt : "Background of a beautiful view"}
      {...rest}
    />
  );
};
