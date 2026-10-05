interface ArticleGutterState {
  /** The reader is showing (not the editor). */
  reading: boolean;
  /** The article does not exist, so there is nothing to put in the Inspector. */
  notFound: boolean;
  /** The "Show wiki TOC" setting. */
  showToc: boolean;
}

/**
 * Whether an article page keeps the shell's reserved Inspector gutter (its contents and page info
 * live there). Every other wiki page gives the gutter back and runs the full content width. The
 * answer must not wait for the article to load, or the column would jump when it arrives.
 */
export function articleUsesInspector({ reading, notFound, showToc }: ArticleGutterState): boolean {
  return reading && !notFound && showToc;
}
