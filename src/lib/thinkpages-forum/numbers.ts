import { POSTS_PER_PAGE } from "./paging";

/** The 1-based position (`#N`) of the post at `index` on `page` among the posts the viewer receives. */
export const postNumberOf = (page: number, index: number): number =>
  (page - 1) * POSTS_PER_PAGE + index + 1;
