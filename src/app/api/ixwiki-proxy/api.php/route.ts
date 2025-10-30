import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const queryParams = url.searchParams.toString();

    // Use local IxWiki path if available (same-server optimization)
    // Otherwise fall back to external HTTPS
    const ixwikiUrl = process.env.IXWIKI_LOCAL_PATH
      ? `${process.env.IXWIKI_LOCAL_PATH}/api.php${queryParams ? `?${queryParams}` : ""}`
      : `https://ixwiki.com/api.php${queryParams ? `?${queryParams}` : ""}`;

    const response = await fetch(ixwikiUrl, {
      method: "GET",
      headers: {
        "User-Agent": "IxStats-Builder",
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    return NextResponse.json(data, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  } catch (error) {
    console.error("IxWiki proxy error:", error);
    return NextResponse.json({ error: "Failed to proxy request to IxWiki" }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}
