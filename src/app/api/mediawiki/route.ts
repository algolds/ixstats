// src/app/api/mediawiki/route.ts
import { NextRequest, NextResponse } from 'next/server';

const MEDIAWIKI_BASE_URL = process.env.NEXT_PUBLIC_MEDIAWIKI_URL || 'https://ixwiki.com';
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 30; // 30 requests per minute

// Simple in-memory rate limiting (use Redis in production)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

function getRateLimitKey(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0] : 'unknown';
  return `mediawiki_${ip}`;
}

function checkRateLimit(key: string): { allowed: boolean; remaining: number; resetTime: number } {
  const now = Date.now();
  const limit = rateLimitMap.get(key);

  if (!limit || now > limit.resetTime) {
    // Reset window
    const resetTime = now + RATE_LIMIT_WINDOW;
    rateLimitMap.set(key, { count: 1, resetTime });
    return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - 1, resetTime };
  }

  if (limit.count >= RATE_LIMIT_MAX_REQUESTS) {
    return { allowed: false, remaining: 0, resetTime: limit.resetTime };
  }

  limit.count++;
  return { 
    allowed: true, 
    remaining: RATE_LIMIT_MAX_REQUESTS - limit.count, 
    resetTime: limit.resetTime 
  };
}

export async function GET(request: NextRequest) {
  // Rate limiting
  const rateLimitKey = getRateLimitKey(request);
  const rateLimit = checkRateLimit(rateLimitKey);

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { 
        error: 'Rate limit exceeded', 
        message: 'Too many requests. Please try again later.',
        resetTime: rateLimit.resetTime
      },
      { 
        status: 429,
        headers: {
          'X-RateLimit-Limit': RATE_LIMIT_MAX_REQUESTS.toString(),
          'X-RateLimit-Remaining': rateLimit.remaining.toString(),
          'X-RateLimit-Reset': rateLimit.resetTime.toString(),
        }
      }
    );
  }

  const { searchParams } = new URL(request.url);
  
  // Validate required parameters
  const action = searchParams.get('action');
  if (!action) {
    return NextResponse.json(
      { error: 'Missing required parameter: action' },
      { status: 400 }
    );
  }

  // Build MediaWiki API URL
  const apiUrl = new URL(`${MEDIAWIKI_BASE_URL}/api.php`);
  apiUrl.searchParams.set('format', 'json');
  apiUrl.searchParams.set('formatversion', '2');
  apiUrl.searchParams.set('origin', '*');

  // Forward all query params from the client request
  searchParams.forEach((value, key) => {
    apiUrl.searchParams.set(key, value);
  });

  console.log(`[MediaWiki API] Making request to: ${apiUrl.toString()}`);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    const response = await fetch(apiUrl.toString(), {
      method: 'GET',
      headers: {
        'User-Agent': 'IxStats/1.0 (https://ixstats.com; contact@ixstats.com)',
        'Accept': 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error(`[MediaWiki API] HTTP Error: ${response.status} ${response.statusText}`);
      return NextResponse.json(
        { 
          error: `MediaWiki API returned status ${response.status}`,
          message: response.statusText,
          status: response.status
        },
        { status: response.status }
      );
    }

    const data = await response.json();

    // Check for MediaWiki API errors
    if (data.error) {
      console.error(`[MediaWiki API] API Error:`, data.error);
      return NextResponse.json(
        { 
          error: 'MediaWiki API Error',
          code: data.error.code,
          message: data.error.info || data.error.message,
          details: data.error
        },
        { status: 400 }
      );
    }

    // Add rate limit headers to successful responses
    return NextResponse.json(data, {
      headers: {
        'X-RateLimit-Limit': RATE_LIMIT_MAX_REQUESTS.toString(),
        'X-RateLimit-Remaining': rateLimit.remaining.toString(),
        'X-RateLimit-Reset': rateLimit.resetTime.toString(),
        'Cache-Control': 'public, max-age=300, s-maxage=300', // 5 minute cache
      }
    });

  } catch (error) {
    console.error('[MediaWiki API] Request failed:', error);
    
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        return NextResponse.json(
          { error: 'Request timeout', message: 'MediaWiki API request timed out' },
          { status: 408 }
        );
      }
      
      return NextResponse.json(
        { 
          error: 'Failed to fetch from MediaWiki API',
          message: error.message,
          type: error.name
        },
        { status: 500 }
      );
    }
    
    return NextResponse.json(
      { error: 'Unknown error occurred' },
      { status: 500 }
    );
  }
}