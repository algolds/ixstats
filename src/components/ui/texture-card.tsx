import * as React from "react";

import { cn } from "~/lib/utils";

const TextureCardStyled = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { children?: React.ReactNode }
>(({ className, children, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("facet-texture-card", className)}
    style={{ "--radius": "24px" } as React.CSSProperties}
    {...props}
  >
    {/* Nested structure for aesthetic borders */}
    <div className="facet-texture-card-level-1">
      <div className="facet-texture-card-level-2">
        <div className="facet-texture-card-level-3">
          {/* Inner content wrapper */}
          <div className="facet-texture-card-inner">{children}</div>
        </div>
      </div>
    </div>
  </div>
));

// Allows for global css overrides and theme support - similar to shad cn
const TextureCard = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { children?: React.ReactNode }
>(({ className, children, ...props }, ref) => {
  return (
    <div ref={ref} className={cn("facet-texture-card", className)} {...props}>
      <div className="facet-texture-card-level-1">
        <div className="facet-texture-card-level-2">
          <div className="facet-texture-card-level-3">
            <div className="facet-texture-card-inner from-card/70 to-secondary/50 bg-gradient-to-b">
              {children}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

TextureCard.displayName = "TextureCard";

const TextureCardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "first:pt-6 last:pb-6", // Adjust padding for first and last child
        className
      )}
      {...props}
    />
  )
);
TextureCardHeader.displayName = "TextureCardHeader";

const TextureCardTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn(
      "pl-2 text-lg leading-tight font-semibold text-neutral-900 dark:text-neutral-100",
      className
    )}
    {...props}
  />
));
TextureCardTitle.displayName = "TextureCardTitle";

const TextureCardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("pl-2 text-sm text-neutral-600 dark:text-neutral-400", className)}
    {...props}
  />
));
TextureCardDescription.displayName = "TextureCardDescription";

const TextureCardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("px-6 py-4", className)} {...props} />
  )
);
TextureCardContent.displayName = "TextureCardContent";

const TextureCardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "flex items-center justify-between gap-2 px-6 py-4",

        className
      )}
      {...props}
    />
  )
);
TextureCardFooter.displayName = "TextureCardFooter";

const TextureSeparator = () => {
  return (
    <div className="border border-t-neutral-50 border-r-transparent border-b-neutral-300/50 border-l-transparent dark:border-t-neutral-950 dark:border-b-neutral-700/50" />
  );
};

export {
  TextureCard,
  TextureCardHeader,
  TextureCardStyled,
  TextureCardFooter,
  TextureCardTitle,
  TextureSeparator,
  TextureCardDescription,
  TextureCardContent,
};

export default TextureCard;
