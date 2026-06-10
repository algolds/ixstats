import { NextRequest, NextResponse } from "next/server";
import { externalApiCache } from "../../../../lib/external-api-cache";

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
      // Strip zero-width characters and control characters that can sneak into filenames
      filename = filename.replace(/[\u200B-\u200F\u2028-\u202F\uFEFF\x00-\x1F]/g, "").trim();

      const isExternalUrl = /^https?:\/\//i.test(filename);

      let directUrl: string | null = null;
      const cacheOptions = {
        service: "mediawiki" as const,
        type: "flag" as const,
        identifier: `althistory:resolution:${filename}`,
        ttl: 30 * 24 * 60 * 60 * 1000, // Cache for 30 days
      };

      try {
        const cached = await externalApiCache.get<{ url: string }>(cacheOptions);
        if (cached?.data?.url) {
          directUrl = cached.data.url;
          console.log(
            `[AltHistory Proxy] Cache HIT for Special:FilePath resolution of ${filename} -> ${directUrl}`
          );
        }
      } catch (cacheErr) {
        console.error("[AltHistory Proxy] Error reading resolution cache:", cacheErr);
      }

      // If the filename is an absolute external URL (e.g. imgur), use it directly
      // instead of trying to resolve via the wiki's API (which would 403).
      if (!directUrl && isExternalUrl) {
        directUrl = filename;
        console.log(`[AltHistory Proxy] External URL detected, using directly: ${filename}`);
        await externalApiCache.set(cacheOptions, { url: filename }).catch(() => {});
      }

      if (!directUrl) {
        // Aligned with wiki-bridge pattern: add origin=* and proper headers
        const apiUrl = new URL("https://althistory.fandom.com/api.php");
        apiUrl.searchParams.set("action", "query");
        apiUrl.searchParams.set("titles", `File:${filename}`);
        apiUrl.searchParams.set("prop", "imageinfo");
        apiUrl.searchParams.set("iiprop", "url");
        apiUrl.searchParams.set("format", "json");
        apiUrl.searchParams.set("origin", "*");

        const maxRetries = 2;
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
          try {
            const abortController = new AbortController();
            const timeoutId = setTimeout(() => abortController.abort(), 10000);

            const apiResponse = await fetch(apiUrl.toString(), {
              headers: {
                "User-Agent": "IxStats-Builder",
                "Api-User-Agent": "IxStats-Builder",
                Accept: "application/json, text/html, */*",
                "Accept-Language": "en-US,en;q=0.9",
              },
              signal: abortController.signal,
            });

            clearTimeout(timeoutId);

            if (apiResponse.ok) {
              const data = (await apiResponse.json()) as any;
              const pages = data.query?.pages ?? {};
              const page = Object.values(pages)[0] as any;
              directUrl = page?.imageinfo?.[0]?.url;
              if (directUrl) {
                console.log(
                  `[AltHistory Proxy] Cache MISS. Resolved Special:FilePath for ${filename} -> ${directUrl}. Caching...`
                );
                await externalApiCache.set(cacheOptions, { url: directUrl });
              }
              break;
            }

            if (apiResponse.status === 403 && attempt < maxRetries) {
              console.warn(
                `[AltHistory Proxy] API returned 403 for ${filename}, retrying (${attempt + 1}/${maxRetries})...`
              );
              await new Promise((resolve) => setTimeout(resolve, 2000 * (attempt + 1)));
              continue;
            }

            break;
          } catch (apiErr) {
            if (attempt < maxRetries) {
              console.warn(
                `[AltHistory Proxy] API error for ${filename}, retrying (${attempt + 1}/${maxRetries}):`,
                apiErr
              );
              await new Promise((resolve) => setTimeout(resolve, 2000 * (attempt + 1)));
              continue;
            }
            console.error(
              "[AltHistory Proxy] Error resolving Special:FilePath via api.php after max retries:",
              apiErr
            );
          }
        }
      }

      if (directUrl) {
        try {
          const wsrvUrl = `https://wsrv.nl/?url=${encodeURIComponent(directUrl)}`;
          const imageResponse = await fetch(wsrvUrl, {
            headers: {
              "User-Agent": "IxStats-Builder",
            },
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
          } else {
            console.warn(
              `[AltHistory Proxy] Image fetch via wsrv.nl failed with status ${imageResponse.status}. Falling back to direct fetch.`
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

            return new NextResponse(null, { status: 502, headers: corsHeaders });
          }
        } catch (imgErr) {
          console.error("[AltHistory Proxy] Error fetching resolved image path:", imgErr);
          return new NextResponse(null, { status: 502, headers: corsHeaders });
        }
      }
    }

    const targetUrl = `https://althistory.fandom.com/${subpath}${queryString}`;

    const response = await fetch(targetUrl, {
      method: "GET",
      headers: {
        "User-Agent": "IxStats-Builder",
        "Api-User-Agent": "IxStats-Builder",
      },
      // Timeout to prevent hanging connections
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      if (
        response.status === 403 ||
        response.status === 503 ||
        response.status === 502 ||
        response.status === 504
      ) {
        console.warn(
          `[AltHistory Proxy] Target returned status ${response.status}. Cannot redirect due to CORP policy.`
        );
        return new NextResponse(null, { status: 502, headers: corsHeaders });
      }

      return new NextResponse(response.body, {
        status: response.status,
        headers: {
          "Content-Type": response.headers.get("Content-Type") || "text/plain",
          ...corsHeaders,
        },
      });
    }

    const contentType = response.headers.get("Content-Type") || "application/octet-stream";
    const arrayBuffer = await response.arrayBuffer();

    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400", // Cache images/files for 1 day
        ...corsHeaders,
      },
    });
  } catch (error) {
    console.error("[AltHistory Proxy] Catch-all error:", error);
    return new NextResponse("Proxy Error", { status: 500, headers: corsHeaders });
  }
}
