import { NextResponse } from 'next/server';

const FONT_CDN_BASE = 'https://fonts.openmaptiles.org';

export async function GET(
  _request: Request,
  context: { params: Promise<{ params?: string[] }> },
) {
  const params = await context.params;
  const parts = params.params?.slice() ?? [];

  if (parts.length < 2) {
    return NextResponse.json({ error: 'Invalid glyph path' }, { status: 400 });
  }

  const range = parts.pop()!;
  const fontstack = parts.join('/');
  const encodedFontstack = encodeURIComponent(fontstack);
  const remoteUrl = `${FONT_CDN_BASE}/${encodedFontstack}/${range}`;

  try {
    const res = await fetch(remoteUrl, {
      headers: {
        'User-Agent': 'IxStats-MapGlyphProxy/1.0',
      },
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Failed to fetch glyphs (${res.status})` },
        { status: res.status },
      );
    }

    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/octet-stream',
        'Cache-Control': 'public, max-age=86400, immutable',
      },
    });
  } catch (error) {
    console.error('Glyph proxy error:', error);
    return NextResponse.json(
      { error: 'Glyph proxy request failed' },
      { status: 502 },
    );
  }
}
