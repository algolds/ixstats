// src/components/shared/editor/postImageClasses.ts
// One display size for images inside posts, shared by the editor and the post bodies so the
// editor previews what gets posted. Arbitrary-variant classes only: stored HTML is never rewritten.
export const POST_IMAGE_CLASSES =
  "[&_img]:my-2 [&_img]:h-auto [&_img]:max-h-[640px] [&_img]:max-w-full [&_img]:rounded-control [&_img]:object-contain";
