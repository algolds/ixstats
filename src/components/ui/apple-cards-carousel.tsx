"use client";
import React, { useEffect, useRef, useState, createContext, useContext } from "react";
import { createPortal } from "react-dom";
import {
  ArrowLeft as IconArrowNarrowLeft,
  ArrowRight as IconArrowNarrowRight,
  Xmark as IconX,
} from "iconoir-react";
import { cn } from "~/lib/utils";
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

export const CarouselContext = createContext<{
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
              "absolute right-0 z-[1000] h-auto w-[5%] overflow-hidden bg-gradient-to-l"
            )}
          ></div>

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
                className="rounded-3xl last:pr-[5%] md:last:pr-[33%]"
              >
                {item}
              </motion.div>
            ))}
          </div>
        </div>
        <div className="mr-10 flex justify-end gap-2">
          <button
            className="relative z-40 flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 disabled:opacity-50"
            onClick={scrollLeft}
            disabled={!canScrollLeft}
          >
            <IconArrowNarrowLeft className="h-6 w-6 text-gray-500" />
          </button>
          <button
            className="relative z-40 flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 disabled:opacity-50"
            onClick={scrollRight}
            disabled={!canScrollRight}
          >
            <IconArrowNarrowRight className="h-6 w-6 text-gray-500" />
          </button>
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
        <div className="fixed inset-0 z-[var(--z-modal,100005)] h-screen overflow-auto">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 h-full w-full bg-black/80 backdrop-blur-lg"
          />
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            ref={containerRef}
            layoutId={layout ? `card-${card.title}` : undefined}
            className="relative z-[60] mx-auto my-10 h-fit max-w-5xl overflow-hidden rounded-3xl bg-white p-4 font-sans md:p-10 dark:bg-neutral-900"
          >
            {/* Modal Background Image with Fade Overlay */}
            {card.src && (
              <div className="pointer-events-none absolute inset-0 -z-10 h-full w-full overflow-hidden">
                <img
                  src={withBasePath(card.src)}
                  alt=""
                  className="h-full w-full object-cover opacity-15 blur-[2px] transition-all duration-300 dark:opacity-25"
                />
                <div className="absolute inset-0 bg-gradient-to-b from-white/20 via-white/80 to-white dark:from-neutral-900/20 dark:via-neutral-900/85 dark:to-neutral-900" />
              </div>
            )}
            <button
              className="sticky top-4 right-0 ml-auto flex h-8 w-8 items-center justify-center rounded-full bg-black dark:bg-white"
              onClick={handleClose}
            >
              <IconX className="h-6 w-6 text-neutral-100 dark:text-neutral-900" />
            </button>
            <motion.div
              layoutId={layout ? `category-${card.title}` : undefined}
              className="text-base font-medium text-black dark:text-white"
            >
              {card.category}
            </motion.div>
            <motion.div
              layoutId={layout ? `title-${card.title}` : undefined}
              className="mt-4 flex items-center gap-3 text-2xl font-semibold text-neutral-700 md:text-5xl dark:text-white"
            >
              {card.logo && (
                <img
                  src={withBasePath(card.logo)}
                  alt=""
                  className="h-10 w-10 shrink-0 rounded-xl border border-neutral-200 object-cover md:h-14 md:w-14 dark:border-neutral-700"
                />
              )}
              <span>{card.title}</span>
            </motion.div>
            {card.description && <div className="mt-2 text-left">{card.description}</div>}
            {card.footer && (
              <div className="mt-4 border-t border-neutral-100 pt-4 text-left dark:border-neutral-800">
                {card.footer}
              </div>
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
        className="relative z-10 flex h-80 w-56 cursor-pointer flex-col items-stretch justify-start overflow-hidden rounded-3xl bg-gray-100 md:h-[40rem] md:w-96 dark:bg-neutral-900"
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 z-30 h-full bg-gradient-to-b from-black/50 via-transparent to-transparent" />
        <div className="relative z-40 flex h-full w-full flex-col items-start justify-between p-8">
          <div className="flex flex-col items-start">
            <motion.div
              layoutId={layout ? `category-${card.title}` : undefined}
              className="text-left font-sans text-sm font-medium text-white md:text-base"
            >
              {card.category}
            </motion.div>
            <motion.div
              layoutId={layout ? `title-${card.title}` : undefined}
              className="mt-2 flex max-w-xs items-center gap-2 text-left font-sans text-xl font-semibold [text-wrap:balance] text-white md:text-3xl"
            >
              {card.logo && (
                <img
                  src={withBasePath(card.logo)}
                  alt=""
                  className="h-7 w-7 shrink-0 rounded-lg border border-white/20 object-cover md:h-9 md:w-9"
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

export const BlurImage = ({ height, width, src, className, alt, ...rest }: ImageProps) => {
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
