// src/lib/commons-flag-importer.ts

export interface CommonsFlagItem {
  pageId: number;
  title: string;
  cleanTitle: string;
  fileUrl: string;
  thumbUrl: string;
  descriptionUrl: string;
  category: string;
  isAlreadyImported?: boolean;
}

export class CommonsFlagImporter {
  private apiUrl = "https://commons.wikimedia.org/w/api.php";
  private userAgent = "IxStatsCommonsImporter/1.0 (https://ixwiki.com; admin@ixwiki.com)";

  /**
   * Clean category input string (supports full Commons URLs or category titles)
   */
  cleanCategoryTitle(input: string): string {
    let cleaned = input.trim();
    if (cleaned.includes("/wiki/")) {
      cleaned = cleaned.split("/wiki/").pop() || cleaned;
    }
    cleaned = decodeURIComponent(cleaned).replace(/\s+/g, "_");
    if (!cleaned.toLowerCase().startsWith("category:")) {
      cleaned = `Category:${cleaned}`;
    }
    return cleaned;
  }

  /**
   * Fetch list of SVG flags in a Commons category with timeout safety
   */
  async fetchCategoryMembers(categoryName: string, limit = 100): Promise<CommonsFlagItem[]> {
    try {
      const categoryTitle = this.cleanCategoryTitle(categoryName);

      // Query both files and subcategories
      const params = new URLSearchParams({
        action: "query",
        list: "categorymembers",
        cmtitle: categoryTitle,
        cmtype: "file|subcat",
        cmlimit: String(limit),
        format: "json",
        origin: "*",
      });

      const response = await fetch(`${this.apiUrl}?${params.toString()}`, {
        headers: {
          "User-Agent": this.userAgent,
        },
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        throw new Error(`Wikimedia Commons API error: ${response.statusText}`);
      }

      const data = await response.json();
      const rawMembers: Array<{ pageid: number; ns: number; title: string }> =
        data?.query?.categorymembers || [];

      // Separate direct files and subcategories
      let fileMembers = rawMembers.filter(
        (m) => m.ns === 6 || m.title.toLowerCase().startsWith("file:")
      );
      const subcatMembers = rawMembers.filter(
        (m) => m.ns === 14 || m.title.toLowerCase().startsWith("category:")
      );

      // If category has subcategories and few direct files, traverse top subcategories
      if (fileMembers.length < limit && subcatMembers.length > 0) {
        for (const subcat of subcatMembers.slice(0, 4)) {
          const subParams = new URLSearchParams({
            action: "query",
            list: "categorymembers",
            cmtitle: subcat.title.replace(/\s+/g, "_"),
            cmtype: "file",
            cmlimit: String(Math.min(40, limit - fileMembers.length)),
            format: "json",
            origin: "*",
          });

          try {
            const subRes = await fetch(`${this.apiUrl}?${subParams.toString()}`, {
              headers: { "User-Agent": this.userAgent },
              signal: AbortSignal.timeout(5000),
            });
            if (subRes.ok) {
              const subData = await subRes.json();
              const subFiles: Array<{ pageid: number; ns: number; title: string }> =
                subData?.query?.categorymembers || [];
              for (const sf of subFiles) {
                if (!fileMembers.some((f) => f.pageid === sf.pageid)) {
                  fileMembers.push(sf);
                }
              }
            }
          } catch {
            // Continue on subcat error
          }
          if (fileMembers.length >= limit) break;
        }
      }

      // Filter to image files (.svg, .png, .jpg, .jpeg, .webp)
      const imageFiles = fileMembers.filter((m) => {
        const t = m.title.toLowerCase();
        return (
          t.endsWith(".svg") ||
          t.endsWith(".png") ||
          t.endsWith(".jpg") ||
          t.endsWith(".jpeg") ||
          t.endsWith(".webp")
        );
      });
      if (imageFiles.length === 0) return [];

      // Fetch image URLs in chunks of 25 pageIds to avoid URL length issues
      const pages: Record<string, any> = {};
      const chunkSize = 25;
      for (let i = 0; i < imageFiles.length; i += chunkSize) {
        const chunk = imageFiles.slice(i, i + chunkSize);
        const pageIds = chunk.map((m) => m.pageid).join("|");
        const infoParams = new URLSearchParams({
          action: "query",
          pageids: pageIds,
          prop: "imageinfo",
          iiprop: "url|size|mime",
          format: "json",
          origin: "*",
        });

        try {
          const infoResponse = await fetch(`${this.apiUrl}?${infoParams.toString()}`, {
            headers: { "User-Agent": this.userAgent },
            signal: AbortSignal.timeout(8000),
          });

          if (infoResponse.ok) {
            const infoData = await infoResponse.json();
            Object.assign(pages, infoData?.query?.pages || {});
          }
        } catch (err) {
          console.warn("[Commons Flag Importer] Error fetching imageinfo chunk:", err);
        }
      }

      const items: CommonsFlagItem[] = [];

      for (const file of imageFiles) {
        const page = pages[file.pageid];
        const imageinfo = page?.imageinfo?.[0];
        if (!imageinfo?.url) continue;

        // Clean title (remove "File:" prefix and file extension, replace underscores with spaces)
        let cleanTitle = file.title
          .replace(/^File:/i, "")
          .replace(/\.(svg|png|jpg|jpeg|webp)$/i, "")
          .replace(/_/g, " ")
          .trim();

        // Further clean common flag file name prefixes
        cleanTitle = cleanTitle.replace(/^Flag of /i, "Flag of ").replace(/^Flag /i, "Flag ");

        items.push({
          pageId: file.pageid,
          title: file.title,
          cleanTitle,
          fileUrl: imageinfo.url,
          thumbUrl: imageinfo.url,
          descriptionUrl: imageinfo.descriptionurl || imageinfo.url,
          category: categoryTitle,
        });
      }

      return items;
    } catch (error) {
      console.error("[Commons Flag Importer] Error fetching category members:", error);
      throw error;
    }
  }
}

export const commonsFlagImporter = new CommonsFlagImporter();
