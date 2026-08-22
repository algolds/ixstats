import {
  fetchCommonsCategoryMembers,
  type CommonsCategoryItem,
} from "~/lib/wiki-os/adapters/mediawiki/bridge";

export type CommonsFlagItem = CommonsCategoryItem & {
  isAlreadyImported?: boolean;
};

export class CommonsFlagImporter {
  /**
   * Fetch list of SVG flags in a Commons category using central wiki primitives.
   */
  async fetchCategoryMembers(categoryName: string, limit = 100): Promise<CommonsFlagItem[]> {
    const items = await fetchCommonsCategoryMembers(categoryName, limit);
    return items.map((item) => ({
      ...item,
      isAlreadyImported: false,
    }));
  }
}

export const commonsFlagImporter = new CommonsFlagImporter();
