// src/app/api/mediawiki/route.ts
import { type NextRequest, NextResponse } from 'next/server';
import { MEDIAWIKI_CONFIG, buildApiUrl } from '~/lib/mediawiki-config';
import { ixnayWiki } from '~/lib/mediawiki-service';

// Use values from the shared configuration
const RATE_LIMIT_WINDOW = MEDIAWIKI_CONFIG.rateLimit.windowMs; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = MEDIAWIKI_CONFIG.rateLimit.maxRequests; // 30 requests per minute

// Simple in-memory rate limiting with cleanup (use Redis in production)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

// Cleanup expired rate limit entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, limit] of rateLimitMap.entries()) {
    if (now > limit.resetTime) {
      rateLimitMap.delete(key);
    }
  }
}, 5 * 60 * 1000);

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

async function handleMediaWikiRequest(request: NextRequest, searchParams: URLSearchParams, requestBody?: any) {
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
  
  // Handle enhanced infobox extraction endpoint
  if (searchParams.get('getInfoboxHtml') === 'true') {
    const pageName = searchParams.get('page');
    if (!pageName) {
      return NextResponse.json(
        { error: 'Missing required parameter: page' },
        { status: 400 }
      );
    }
    
    try {
      console.log(`[MediaWiki API] Getting complete infobox for: ${pageName}`);
      
      // Use the enhanced MediaWiki service to get complete infobox
      const infobox = await ixnayWiki.getCountryInfobox(pageName);
      
      if (!infobox) {
        return NextResponse.json(
          {
            error: 'No infobox found',
            message: `Could not find or parse infobox for ${pageName}`,
            page: pageName,
            timestamp: new Date().toISOString()
          },
          { status: 404 }
        );
      }

      // Return the rendered HTML from the complete template parsing
      const htmlContent = infobox.renderedHtml;
      
      if (!htmlContent) {
        return NextResponse.json(
          {
            error: 'No rendered content',
            message: `Infobox found but could not render HTML for ${pageName}`,
            page: pageName,
            hasRawWikitext: !!infobox.rawWikitext,
            hasParsedData: !!infobox.parsedTemplateData,
            parsedDataKeys: infobox.parsedTemplateData ? Object.keys(infobox.parsedTemplateData).length : 0,
            timestamp: new Date().toISOString()
          },
          { status: 400 }
        );
      }

      return NextResponse.json(
        { 
          html: htmlContent,
          meta: {
            page: pageName,
            extractionSuccessful: true,
            extractedLength: htmlContent.length,
            hasRawWikitext: !!infobox.rawWikitext,
            rawWikitextLength: infobox.rawWikitext?.length || 0,
            hasParsedData: !!infobox.parsedTemplateData,
            parsedDataKeys: infobox.parsedTemplateData ? Object.keys(infobox.parsedTemplateData).length : 0,
            timestamp: new Date().toISOString(),
            extractionMethod: 'complete_template_parsing'
          }
        },
        {
          headers: {
            'X-RateLimit-Limit': RATE_LIMIT_MAX_REQUESTS.toString(),
            'X-RateLimit-Remaining': rateLimit.remaining.toString(),
            'X-RateLimit-Reset': rateLimit.resetTime.toString(),
            'Cache-Control': `public, max-age=${MEDIAWIKI_CONFIG.cache.infoboxTtl / 1000}, s-maxage=${MEDIAWIKI_CONFIG.cache.infoboxTtl / 1000}`,
          }
        }
      );
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error(`[MediaWiki API] Error getting complete infobox for ${pageName}:`, error);
      
      return NextResponse.json(
        {
          error: 'Exception during enhanced content parsing',
          message: errorMessage,
          page: pageName,
          timestamp: new Date().toISOString(),
          type: error instanceof Error ? error.name : 'UnknownError'
        },
        { 
          status: 500,
          headers: {
            'X-RateLimit-Limit': RATE_LIMIT_MAX_REQUESTS.toString(),
            'X-RateLimit-Remaining': rateLimit.remaining.toString(),
            'X-RateLimit-Reset': rateLimit.resetTime.toString(),
          }
        }
      );
    }
  }

  // Handle full content endpoint for debugging/development
  if (searchParams.get('getFullContent') === 'true') {
    const pageName = searchParams.get('page');
    if (!pageName) {
      return NextResponse.json(
        { error: 'Missing required parameter: page' },
        { status: 400 }
      );
    }
    
    try {
      const wikitext = await ixnayWiki.getPageWikitext(pageName);
      
      if (!wikitext || typeof wikitext !== 'string') {
        return NextResponse.json(
          {
            error: typeof wikitext === 'object' && wikitext.error ? wikitext.error : 'Failed to get page wikitext',
            page: pageName,
            timestamp: new Date().toISOString()
          },
          { status: 404 }
        );
      }
      
      return NextResponse.json(
        { 
          wikitext: wikitext,
          meta: {
            page: pageName,
            wikitextLength: wikitext.length,
            method: 'query_revisions_section_0',
            timestamp: new Date().toISOString()
          }
        },
        {
          headers: {
            'X-RateLimit-Limit': RATE_LIMIT_MAX_REQUESTS.toString(),
            'X-RateLimit-Remaining': rateLimit.remaining.toString(),
            'X-RateLimit-Reset': rateLimit.resetTime.toString(),
            'Cache-Control': `public, max-age=${MEDIAWIKI_CONFIG.cache.pageTtl / 1000}, s-maxage=${MEDIAWIKI_CONFIG.cache.pageTtl / 1000}`,
          }
        }
      );
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error(`[MediaWiki API] Exception getting wikitext for ${pageName}:`, error);
      
      return NextResponse.json(
        {
          error: 'Exception during wikitext retrieval',
          message: errorMessage,
          page: pageName,
          timestamp: new Date().toISOString()
        },
        { status: 500 }
      );
    }
  }

  // Validate required parameters for standard API proxy
  const action = searchParams.get('action');
  if (!action) {
    return NextResponse.json(
      { error: 'Missing required parameter: action' },
      { status: 400 }
    );
  }

  // Build MediaWiki API URL for standard proxy using the helper from config
  const params: Record<string, string> = {};
  searchParams.forEach((value, key) => {
    params[key] = value;
  });
  
  // Add any parameters from request body (for POST requests)
  if (requestBody) {
    Object.keys(requestBody).forEach(key => {
      if (requestBody[key] !== undefined) {
        params[key] = requestBody[key];
      }
    });
  }
  
  // Ensure format is set
  params.format = params.format || 'json';
  params.formatversion = params.formatversion || '2';

  // Determine if we should use GET or POST based on content length
  const isLongContent = requestBody?.text && requestBody.text.length > 1500;
  
  let response;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), MEDIAWIKI_CONFIG.timeout);

  try {
    if (isLongContent) {
      // Use POST for long content to avoid URI too long errors
      const formData = new URLSearchParams();
      Object.keys(params).forEach(key => {
        const value = params[key];
        if (value !== undefined) {
          formData.append(key, value);
        }
      });

      console.log(`[MediaWiki API] Making POST request for long content (${requestBody.text.length} chars)`);
      
      response = await fetch(`${MEDIAWIKI_CONFIG.baseUrl}${MEDIAWIKI_CONFIG.apiEndpoint}`, {
        method: 'POST',
        headers: {
          'User-Agent': MEDIAWIKI_CONFIG.userAgent,
          'Accept': 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData,
        signal: controller.signal,
      });
    } else {
      // Use GET for regular requests
      const apiUrl = buildApiUrl(MEDIAWIKI_CONFIG.baseUrl, params);
      console.log(`[MediaWiki API] Making GET request to: ${apiUrl}`);

      response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'User-Agent': MEDIAWIKI_CONFIG.userAgent,
          'Accept': 'application/json',
        },
        signal: controller.signal,
      });
    }

  } catch (error) {
    clearTimeout(timeoutId);
    if (process.env.NODE_ENV !== 'production') {
      console.error('[MediaWiki API] Request failed:', error);
    }
    
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

  clearTimeout(timeoutId);

  if (!response.ok) {
    if (process.env.NODE_ENV !== 'production') {
      console.error(`[MediaWiki API] HTTP Error: ${response.status} ${response.statusText}`);
    }

    const payload: Record<string, any> = {
      error: `MediaWiki API returned status ${response.status}`,
      message: response.statusText,
      status: response.status
    };

    if (response.status === 404) {
      payload.notFound = true;
    }

    const statusCode = response.status === 404 ? 200 : response.status;

    return NextResponse.json(payload, {
      status: statusCode,
      headers: {
        'X-RateLimit-Limit': RATE_LIMIT_MAX_REQUESTS.toString(),
        'X-RateLimit-Remaining': rateLimit.remaining.toString(),
        'X-RateLimit-Reset': rateLimit.resetTime.toString(),
      }
    });
  }

  const data = await response.json();

  // Check for MediaWiki API errors
  if (data.error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error(`[MediaWiki API] API Error:`, data.error);
    }
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
      'Cache-Control': `public, max-age=${MEDIAWIKI_CONFIG.cache.pageTtl / 1000 / 12}, s-maxage=${MEDIAWIKI_CONFIG.cache.pageTtl / 1000 / 12}`, // 5 minute cache
    }
  });
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  return handleMediaWikiRequest(request, searchParams);
}

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  let requestBody = {};
  
  try {
    const contentType = request.headers.get('content-type') || '';
    
    if (contentType.includes('application/json')) {
      requestBody = await request.json();
    } else if (contentType.includes('application/x-www-form-urlencoded')) {
      const formData = await request.formData();
      requestBody = Object.fromEntries(formData.entries());
    }
  } catch (error) {
    console.error('[MediaWiki API] Error parsing request body:', error);
  }
  
  return handleMediaWikiRequest(request, searchParams, requestBody);
}

/**
 * Clear cache for a specific country
 */
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const countryName = searchParams.get('country');
    
    if (!countryName) {
      return NextResponse.json({
        success: false,
        error: 'Country name is required'
      }, { status: 400 });
    }
    
    // Clear cache for the specific country
    ixnayWiki.clearCountryCache(countryName);
    
    console.log(`[MediaWiki API] Cache cleared for country: ${countryName} - will use enhanced template and wikilink processing`);
    
    return NextResponse.json({
      success: true,
      message: `Cache cleared for ${countryName}. The country will now use enhanced template and wikilink processing with clickable links.`,
      country: countryName,
      features: [
        'Enhanced template processing ({{wp}}, {{link}}, etc.)',
        'Clickable wikilinks with color #429284',
        'Proper HTML rendering with hover effects',
        'XSS protection and URL normalization'
      ]
    });
    
  } catch (error) {
    console.error('[MediaWiki API] Error clearing cache:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
