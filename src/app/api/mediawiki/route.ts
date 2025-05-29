import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const baseUrl = process.env.NEXT_PUBLIC_MEDIAWIKI_URL || 'https://ixwiki.com';

  const url = new URL(`${baseUrl}/api.php`);
  url.searchParams.set('format', 'json');
  url.searchParams.set('formatversion', '2');
  url.searchParams.set('origin', '*');

  // Forward all query params from the client request
  searchParams.forEach((value, key) => {
    url.searchParams.set(key, value);
  });

  try {
    const response = await fetch(url.toString());

    if (!response.ok) {
      return NextResponse.json(
        { error: `MediaWiki API returned status ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch from MediaWiki API' },
      { status: 500 }
    );
  }
}
