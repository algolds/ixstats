import { NextRequest, NextResponse } from 'next/server';

async function getServerIP(): Promise<string> {
  try {
    const response = await fetch('https://api.ipify.org?format=json', { signal: AbortSignal.timeout(2000) });
    const data = await response.json() as { ip: string };
    return data.ip;
  } catch {
    return 'unknown';
  }
}

export async function GET(request: NextRequest) {
  const requestId = Math.random().toString(36).substring(7);
  const timestamp = new Date().toISOString();
  
  try {
    const url = new URL(request.url);
    const queryParams = url.searchParams.toString();
    
    // Get server IP for logging
    const serverIP = await getServerIP();
    
    // Proxy the request to iiwiki.com API
    const iiwikiUrl = `https://iiwiki.com/mediawiki/api.php${queryParams ? `?${queryParams}` : ''}`;
    
    const requestHeaders = {
      'User-Agent': 'IxStats-Builder',
      'Accept': 'application/json',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'Sec-Fetch-Dest': 'empty',
      'Sec-Fetch-Mode': 'cors',
      'Sec-Fetch-Site': 'same-origin',
    };
    
    // Detailed logging for admin
    console.log('\n========== IIWiki API Request ==========');
    console.log(`[${timestamp}] Request ID: ${requestId}`);
    console.log(`Server IP: ${serverIP}`);
    console.log(`Target URL: ${iiwikiUrl}`);
    console.log(`Request Headers:`);
    Object.entries(requestHeaders).forEach(([key, value]) => {
      console.log(`  ${key}: ${value}`);
    });
    console.log('========================================\n');
    
    const response = await fetch(iiwikiUrl, {
      method: 'GET',
      headers: requestHeaders,
    });

    // Log response details
    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });
    
    console.log('\n========== IIWiki API Response ==========');
    console.log(`[${timestamp}] Request ID: ${requestId}`);
    console.log(`Response Status: ${response.status} ${response.statusText}`);
    console.log(`Response Headers:`);
    Object.entries(responseHeaders).forEach(([key, value]) => {
      console.log(`  ${key}: ${value}`);
    });
    
    // Highlight Cloudflare headers
    const cfHeaders = Object.entries(responseHeaders).filter(([key]) => 
      key.toLowerCase().startsWith('cf-') || key.toLowerCase().includes('cloudflare')
    );
    if (cfHeaders.length > 0) {
      console.log(`Cloudflare Headers:`);
      cfHeaders.forEach(([key, value]) => {
        console.log(`  ${key}: ${value}`);
      });
    }
    console.log('=========================================\n');
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('\n========== IIWiki API Error ==========');
      console.error(`Request ID: ${requestId}`);
      console.error(`Status: ${response.status} ${response.statusText}`);
      console.error(`Error Body (first 500 chars):`, errorText.substring(0, 500));
      console.error('======================================\n');
      
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    
    console.log(`[${requestId}] ✓ Success - returned ${JSON.stringify(data).length} bytes\n`);

    return NextResponse.json(data, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'X-Request-ID': requestId,
      },
    });
  } catch (error) {
    console.error('\n========== IIWiki Proxy Exception ==========');
    console.error(`Request ID: ${requestId}`);
    console.error(`Timestamp: ${timestamp}`);
    console.error('Error:', error);
    console.error('===========================================\n');
    
    return NextResponse.json(
      { 
        error: 'Failed to proxy request to IIWiki',
        requestId,
        details: error instanceof Error ? error.message : 'Unknown error'
      },
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