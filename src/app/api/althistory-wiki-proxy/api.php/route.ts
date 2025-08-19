import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const queryParams = url.searchParams.toString();
    
    // Proxy the request to ixwiki.com API
    const ixwikiUrl = `https://althistory.fandom.com/api.php${queryParams ? `?${queryParams}` : ''}`;
    
    const response = await fetch(ixwikiUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'IxStats-Builder/1.0 (https://ixstats.com) MediaWiki-Search',
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    return NextResponse.json(data, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  } catch (error) {
    console.error('AltHistory Wiki API proxy error:', error);
    return NextResponse.json(
      { error: 'Failed to proxy request to AltHistory Wiki API' },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}