import { NextRequest, NextResponse } from "next/server";
import { externalApiCache } from "../../../../lib/external-api-cache";

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
          console.log(`[AltHistory Proxy] Cache HIT for Special:FilePath resolution of ${filename} -> ${directUrl}`);
        }
      } catch (cacheErr) {
        console.error("[AltHistory Proxy] Error reading resolution cache:", cacheErr);
      }

      if (!directUrl) {
        const apiQueryUrl = `https://althistory.fandom.com/api.php?action=query&titles=File:${encodeURIComponent(filename)}&prop=imageinfo&iiprop=url&format=json`;
        try {
          const apiResponse = await fetch(apiQueryUrl, {
            headers: {
              "User-Agent": "IxStats-Builder",
              "Api-User-Agent": "IxStats-Builder",
            },
            signal: AbortSignal.timeout(10000),
          });
          if (apiResponse.ok) {
            const data = await apiResponse.json() as any;
            const pages = data.query?.pages ?? {};
            const page = Object.values(pages)[0] as any;
            directUrl = page?.imageinfo?.[0]?.url;
            if (directUrl) {
              console.log(`[AltHistory Proxy] Cache MISS. Resolved Special:FilePath for ${filename} -> ${directUrl}. Caching...`);
              await externalApiCache.set(cacheOptions, { url: directUrl });
            }
          }
        } catch (apiErr) {
          console.error("[AltHistory Proxy] Error resolving Special:FilePath via api.php:", apiErr);
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
              },
            });
          } else {
            console.warn(`[AltHistory Proxy] Image fetch via wsrv.nl failed with status ${imageResponse.status}. Falling back to direct redirect.`);
            return NextResponse.redirect(directUrl, { status: 302 });
          }
        } catch (imgErr) {
          console.error("[AltHistory Proxy] Error fetching resolved image path via wsrv.nl:", imgErr);
          return NextResponse.redirect(directUrl, { status: 302 });
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
          `[AltHistory Proxy] Target returned status ${response.status}. Redirecting browser directly to target to bypass.`
        );
        return NextResponse.redirect(targetUrl, { status: 302 });
      }

      return new NextResponse(response.body, {
        status: response.status,
        headers: {
          "Content-Type": response.headers.get("Content-Type") || "text/plain",
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
      },
    });
  } catch (error) {
    console.error("[AltHistory Proxy] Catch-all error:", error);
    try {
      const resolvedParams = await params;
      const subpath = resolvedParams.path.join("/");
      const searchParams = request.nextUrl.searchParams.toString();
      const queryString = searchParams ? `?${searchParams}` : "";
      const fallbackUrl = `https://althistory.fandom.com/${subpath}${queryString}`;
      return NextResponse.redirect(fallbackUrl, { status: 302 });
    } catch {
      return new NextResponse("Proxy Error", { status: 500 });
    }
  }
}
