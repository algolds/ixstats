import { NextResponse } from 'next/server';

export async function GET() {
  const svg = `
<svg width="32" height="24" viewBox="0 0 32 24" xmlns="http://www.w3.org/2000/svg">
  <rect width="32" height="24" fill="#f0f0f0"/>
  <rect width="32" height="8" fill="#d73a49"/>
  <rect y="8" width="32" height="8" fill="#ffffff"/>
  <rect y="16" width="32" height="8" fill="#d73a49"/>
  <circle cx="16" cy="12" r="3" fill="#6f42c1"/>
</svg>`;

  return new NextResponse(svg, {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=86400', // Cache for 24 hours
    },
  });
} 