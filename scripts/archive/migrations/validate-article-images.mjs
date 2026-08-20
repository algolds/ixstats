#!/usr/bin/env node
/*
  Validation script for /api/wiki/random-articles and /api/wiki/preview-article
  Usage: node scripts/validate-article-images.mjs [baseUrl] [count]
  Example: node scripts/validate-article-images.mjs http://localhost:3000 20
*/

import fetch from 'node-fetch';

const base = process.argv[2] || 'http://localhost:3000';
const count = parseInt(process.argv[3] || '20');
const source = 'ixwiki';

if (isNaN(count) || count < 10 || count > 100) {
  console.error('Count must be between 10 and 100');
  process.exit(1);
}

const url = `${base.replace(/\/$/, '')}/api/wiki/random-articles?count=${count}&minQuality=60&preferImages=true&source=${source}`;
console.log('Requesting:', url);

try {
  const res = await fetch(url, { method: 'GET' });
  console.log('Status:', res.status);
  const json = await res.json();
  let articles = Array.isArray(json.articles) ? json.articles : [];
  if (!articles.length) {
    console.log('No random articles returned; falling back to a small list of sample titles for direct preview checks.');
    const sampleTitles = [
      'HMS Bronington (M1115)',
      'Albert Einstein',
      'Python (programming language)',
      'Barack Obama',
      'New York City',
    ];
    const previews = [];
    for (const t of sampleTitles) {
      try {
        const pUrl = `${base.replace(/\/$/, '')}/api/wiki/preview-article?source=${source}&title=${encodeURIComponent(t)}`;
        const pres = await fetch(pUrl);
        if (pres.ok) {
          const pj = await pres.json();
          previews.push(pj);
        } else {
          console.log('  preview for', t, 'returned status', pres.status);
        }
      } catch (e) {
        console.log('  preview fetch failed for', t, e.message);
      }
    }
    articles = previews;
  }
  console.log('Articles returned:', articles.length);

  let reachableImages = 0;
  let previewMatches = 0;
  let checked = 0;

  for (const art of articles) {
    checked++;
    console.log('\n#', checked, 'Title:', art.title);
    console.log('  qualityScore:', art.qualityScore, ' hasImage:', art.hasImage, ' artwork:', art.artwork);

    // Normalize artwork URL
    let artworkUrl = art.artwork || null;
    if (artworkUrl && !/^https?:\/\//i.test(artworkUrl)) {
      if (artworkUrl.startsWith('/')) artworkUrl = base.replace(/\/$/, '') + artworkUrl;
      else artworkUrl = base.replace(/\/$/, '') + '/' + artworkUrl;
    }

    if (artworkUrl) {
      try {
        // Try HEAD then GET
        let ok = false;
        try {
          const head = await fetch(artworkUrl, { method: 'HEAD' });
          console.log('  artwork HEAD status:', head.status);
          ok = head.ok;
        } catch (e) {
          // HEAD might be blocked, try GET
        }
        if (!ok) {
          const get = await fetch(artworkUrl, { method: 'GET' });
          console.log('  artwork GET status:', get.status);
          if (get.ok) ok = true;
        }
        if (ok) reachableImages++;
      } catch (e) {
        console.log('  artwork fetch failed:', e.message);
      }
    }

    // Fetch preview-article and compare
    try {
      const previewUrl = `${base.replace(/\/$/, '')}/api/wiki/preview-article?source=${source}&title=${encodeURIComponent(art.title)}`;
      const pRes = await fetch(previewUrl);
      console.log('  preview status:', pRes.status);
      if (pRes.ok) {
        const pJson = await pRes.json();
        const pArtwork = pJson.artwork || null;
        const pHasImage = !!pJson.hasImage;
        const normalizedPArtwork = pArtwork && !/^https?:\/\//i.test(pArtwork)
          ? (pArtwork.startsWith('/') ? base.replace(/\/$/, '') + pArtwork : base.replace(/\/$/, '') + '/' + pArtwork)
          : pArtwork;

        const artMatch = (normalizedPArtwork && artworkUrl && normalizedPArtwork === artworkUrl);
        const hasImageMatch = (pHasImage === !!art.hasImage);
        if (artMatch || hasImageMatch) {
          console.log('  preview matches random-articles (artwork or hasImage)');
          previewMatches++;
        } else {
          console.log('  preview mismatch: preview.artwork=', normalizedPArtwork, ' preview.hasImage=', pHasImage);
        }
      } else {
        console.log('  preview endpoint returned non-OK');
      }
    } catch (e) {
      console.log('  preview fetch failed:', e.message);
    }
  }

  console.log('\nSummary:');
  console.log(' total articles:', articles.length);
  console.log(' reachable images:', reachableImages);
  console.log(' preview matches:', previewMatches);
} catch (err) {
  console.error('Fetch failed:', err.message || err);
  process.exit(2);
}
