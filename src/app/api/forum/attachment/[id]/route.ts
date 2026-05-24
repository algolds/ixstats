import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const apiKey = process.env.XENFORO_API_KEY;
  const apiUrl = process.env.XENFORO_API_URL || "https://forum.ixwiki.com/api";

  if (!apiKey) {
    return NextResponse.json({ error: "Forum not configured" }, { status: 503 });
  }

  try {
    const response = await fetch(`${apiUrl}/attachments/${id}/data`, {
      headers: { "XF-Api-Key": apiKey },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      return NextResponse.json({ error: "Attachment not found" }, { status: response.status });
    }

    const contentType = response.headers.get("content-type") || "application/octet-stream";
    const data = await response.arrayBuffer();

    return new NextResponse(data, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch {
    return NextResponse.json({ error: "Failed to fetch attachment" }, { status: 502 });
  }
}
