import { NextRequest, NextResponse } from "next/server";
import { externalApiCache } from "~/lib/cache";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cross-Origin-Resource-Policy": "cross-origin",
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: corsHeaders,
  });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const resolvedParams = await params;
    const subpath = resolvedParams.path.join("/");
    const searchParams = request.nextUrl.searchParams.toString();
    const queryString = searchParams ? `?${searchParams}` : "";

    // Intercept Special:FilePath/Special:Filepath and resolve via api.php
    const filePathMatch = subpath.match(/Special:Filepath\/(.+)$/i);
    if (filePathMatch && filePathMatch[1]) {
      let filename = decodeURIComponent(filePathMatch[1]);
      if (filename.includes("|")) {
        filename = filename.split("|")[0]!.trim();
      }
      filename = filename.replace(/[\u200B-\u200F\u2028-\u202F\uFEFF\x00-\x1F]/g, "").trim();

      let directUrl: string | null = null;
      const cacheOptions = {
        service: "mediawiki" as const,
        type: "flag" as const,
        identifier: `commons:resolution:${filename}`,
        ttl: 30 * 24 * 60 * 60 * 1000, // Cache for 30 days
      };

      try {
        const cached = await externalApiCache.get<{ url: string }>(cacheOptions);
        if (cached?.data?.url) {
          directUrl = cached.data.url;
        }
      } catch (cacheErr) {
        console.error("[Commons Proxy] Error reading cache:", cacheErr);
      }

      if (!directUrl) {
        const apiUrl = new URL("https://commons.wikimedia.org/w/api.php");
        apiUrl.searchParams.set("action", "query");
        apiUrl.searchParams.set("titles", `File:${filename}`);
        apiUrl.searchParams.set("prop", "imageinfo");
        apiUrl.searchParams.set("iiprop", "url");
        apiUrl.searchParams.set("format", "json");
        apiUrl.searchParams.set("origin", "*");

        try {
          const apiResponse = await fetch(apiUrl.toString(), {
            headers: {
              "User-Agent": "IxStats-Builder",
              Accept: "application/json",
            },
            signal: AbortSignal.timeout(10000),
          });

          if (apiResponse.ok) {
            const data = (await apiResponse.json()) as any;
            const pages = data.query?.pages ?? {};
            const page = Object.values(pages)[0] as any;
            directUrl = page?.imageinfo?.[0]?.url;
            if (directUrl) {
              await externalApiCache.set(cacheOptions, { url: directUrl }).catch(() => {});
            }
          }
        } catch (apiErr) {
          console.error("[Commons Proxy] Error resolving Special:FilePath:", apiErr);
        }
      }

      if (directUrl) {
        try {
          const wsrvUrl = `https://wsrv.nl/?url=${encodeURIComponent(directUrl)}`;
          const imageResponse = await fetch(wsrvUrl, {
            headers: { "User-Agent": "IxStats-Builder" },
            signal: AbortSignal.timeout(15000),
          });
          if (imageResponse.ok) {
            const contentType = imageResponse.headers.get("Content-Type") || "image/png";
            const arrayBuffer = await imageResponse.arrayBuffer();
            return new NextResponse(arrayBuffer, {
              status: 200,
              headers: {
                "Content-Type": contentType,
                "Cache-Control": "public, max-age=86400",
                ...corsHeaders,
              },
            });
          }

          // Fallback: fetch directly from Commons if wsrv.nl fails
          console.warn(
            `[Commons Proxy] wsrv.nl fetch failed, falling back to direct fetch: ${directUrl}`
          );
          const directResp = await fetch(directUrl, {
            headers: { "User-Agent": "IxStats-Builder" },
            signal: AbortSignal.timeout(15000),
          });
          if (directResp.ok) {
            const contentType = directResp.headers.get("Content-Type") || "image/png";
            const arrayBuffer = await directResp.arrayBuffer();
            return new NextResponse(arrayBuffer, {
              status: 200,
              headers: {
                "Content-Type": contentType,
                "Cache-Control": "public, max-age=86400",
                ...corsHeaders,
              },
            });
          }
          console.warn(`[Commons Proxy] Direct fetch also failed with status ${directResp.status}`);
        } catch (imgErr) {
          console.error("[Commons Proxy] Error fetching resolved image path:", imgErr);
        }
      }

      // File matched Special:Filepath but was not found on Commons — return 404
      return new NextResponse(null, { status: 404, headers: corsHeaders });
    }

    const targetUrl = `https://commons.wikimedia.org/${subpath}${queryString}`;
    const response = await fetch(targetUrl, {
      method: "GET",
      headers: {
        "User-Agent": "IxStats-Builder",
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      return new NextResponse(null, { status: 502, headers: corsHeaders });
    }

    const contentType = response.headers.get("Content-Type") || "application/octet-stream";
    const arrayBuffer = await response.arrayBuffer();

    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400",
        ...corsHeaders,
      },
    });
  } catch (error) {
    console.error("[Commons Proxy] Catch-all error:", error);
    return new NextResponse("Proxy Error", { status: 500, headers: corsHeaders });
  }
}
