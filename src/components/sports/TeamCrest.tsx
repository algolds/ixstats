/** A team's logo, or the default shield tinted with its colour when it has none. */
export function TeamCrest({
  src,
  alt,
  color,
  shieldClassName = "h-full w-full",
}: {
  src?: string | null;
  alt: string;
  color?: string;
  shieldClassName?: string;
}) {
  if (src) {
    return <img src={src} alt={alt} className="h-full w-full rounded-full object-contain" />;
  }
  return (
    <svg
      viewBox="0 0 420 420"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={shieldClassName}
      style={{ color }}
    >
      <path
        d="M201.646 416.137C144.946 389.951 97.469 343.545 60.543 278.221C30.33 224.771 13.58 169.737 4.849 132.979L0 112.558L20.478 108.517C29.676 106.701 36.353 98.519 36.353 89.064C36.353 87.535 36.171 85.986 35.811 84.46L31.579 64.862L68.813 56.045V18.129L83.947 14.518C125.355 4.884 167.706 0 210.202 0C252.699 0 294.762 4.884 336.17 14.518L351.208 18.129V56.045L388.444 64.862L384.015 84.461C383.657 85.986 383.572 87.538 383.572 89.064C383.572 98.519 390.297 106.701 399.497 108.517L420 112.558L415.161 132.981C406.428 169.739 389.684 224.774 359.473 278.221C322.549 343.545 275.075 389.95 218.367 416.141L210.01 420L201.646 416.137Z"
        fill="currentColor"
      />
    </svg>
  );
}
