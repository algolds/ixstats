#!/usr/bin/env node
/*
  Lightweight ESM test script for /api/wiki/random-articles
  Usage: node scripts/test-random-articles.mjs [baseUrl] [count]
  Example: node scripts/test-random-articles.mjs http://localhost:3000 8
*/

import fetch from 'node-fetch';

async function main() {
  const base = process.argv[2] || 'http://localhost:3000';
  const count = parseInt(process.argv[3] || '8');
  const url = `${base}/api/wiki/random-articles?count=${count}&minQuality=60&preferImages=true&source=ixwiki`;
  console.log('Requesting:', url);
  try {
    const res = await fetch(url, { method: 'GET' });
    console.log('Status:', res.status);
    const json = await res.json();
    if (Array.isArray(json.articles)) {
      console.log('Articles returned:', json.articles.length);
      for (const a of json.articles) {
        console.log('-', a.title, '| q=', a.qualityScore, '| hasImage=', a.hasImage);
      }
    } else {
      console.log('Body keys:', Object.keys(json));
      console.log(json);
    }
  } catch (err) {
    console.error('Fetch failed:', err);
  }
}

main();
