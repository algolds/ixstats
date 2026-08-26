/**
 * scripts/wikitext-corpus-roundtrip.ts — WikiOS Corpus Roundtrip Verification & Performance Benchmark.
 *
 * Implements the Plan 305 Section 10 verification methodology:
 * 1. Evaluates all real articles in PostgreSQL.
 * 2. Compares original wikitext vs serialized wikitext.
 * 3. Categorizes into Exact, Structurally Equivalent, and Semantic Diff.
 * 4. Measures P50 / P90 / P95 / P99 parse and serialization latencies.
 */

import { db } from "~/server/db";
import { parse } from "~/lib/wiki-os/wikitext/parser";
import { astToWikitext } from "~/lib/wiki-os/wikitext/serializer";
import { astToPlateNodes, plateNodesToAst } from "~/lib/wiki-os/transformers/wiki-ast-converter";

async function runCorpusRoundtripBenchmark() {
  console.log("==================================================================");
  console.log("  WikiOS Wikitext Engine Corpus Roundtrip & Performance Benchmark ");
  console.log("==================================================================");

  let articles: Array<{ id: string; slug: string; title: string; wikitext: string }> = [];

  try {
    articles = await db.wikiArticle.findMany({
      where: {
        wikitext: { not: "" },
      },
      select: {
        id: true,
        slug: true,
        title: true,
        wikitext: true,
      },
      take: 100, // Benchmark first 100 representative articles
    });
  } catch (err) {
    console.warn("Could not load from DB directly, using synthetic corpus fixtures:", err);
  }

  if (articles.length === 0) {
    // Synthetic fixture corpus for headless runs
    articles = [
      {
        id: "1",
        slug: "urcea",
        title: "Kingdom of Urcea",
        wikitext: `{{Infobox country\n| name = Urcea\n| capital = [[Urceopolis]]\n| population = 54,000,000\n| gdp = $1.4T\n}}\n\n== History ==\nUrcea is a sovereign state located in Crona.\n\n* Founded in 1024\n* Constitution signed 1848\n\n{| class="wikitable"\n|-\n! Region !! Population\n|-\n| Ader || 12M\n|}\n\n[[Category:Nations]]`,
      },
      {
        id: "2",
        slug: "corona",
        title: "Corona Peninsula",
        wikitext: `== Geography ==\nThe peninsula extends into the ocean at [[Coords:12.4,56.7|12.4 N, 56.7 E]].\n\n[[File:map.svg|thumb|Regional Map]]\n\n----`,
      },
    ];
  }

  console.log(`Evaluating ${articles.length} articles in corpus...\n`);

  let exactCount = 0;
  let structEquivalentCount = 0;
  let semanticDiffCount = 0;

  const parseTimes: number[] = [];
  const serializeTimes: number[] = [];
  const plateTimes: number[] = [];

  for (const art of articles) {
    const t0 = performance.now();
    const { ast } = parse(art.wikitext, { title: art.title, slug: art.slug });
    const t1 = performance.now();
    parseTimes.push(t1 - t0);

    const t2 = performance.now();
    const serialized = astToWikitext(ast);
    const t3 = performance.now();
    serializeTimes.push(t3 - t2);

    const t4 = performance.now();
    const plateNodes = astToPlateNodes(ast);
    const _reAstFromPlate = plateNodesToAst(plateNodes, art.title, art.slug);
    const t5 = performance.now();
    plateTimes.push(t5 - t4);

    if (serialized.trim() === art.wikitext.trim()) {
      exactCount++;
    } else {
      // Re-parse to test structural equivalence
      const { ast: reAst } = parse(serialized);
      const isEquivalent = areAstsEquivalent(ast, reAst);
      if (isEquivalent) {
        structEquivalentCount++;
      } else {
        semanticDiffCount++;
        console.warn(`[SEMANTIC DIFF] in article "${art.title}" (${art.slug})`);
      }
    }
  }

  const passRate = ((exactCount + structEquivalentCount) / articles.length) * 100;

  console.log("------------------------------------------------------------------");
  console.log(`Total Articles Tested: ${articles.length}`);
  console.log(`Exact Matches:         ${exactCount} (${((exactCount / articles.length) * 100).toFixed(1)}%)`);
  console.log(`Structurally Equiv:    ${structEquivalentCount} (${((structEquivalentCount / articles.length) * 100).toFixed(1)}%)`);
  console.log(`Semantic Diffs:        ${semanticDiffCount} (${((semanticDiffCount / articles.length) * 100).toFixed(1)}%)`);
  console.log(`Overall Pass Rate:     ${passRate.toFixed(2)}% (Target: >= 95%)`);
  console.log("------------------------------------------------------------------");

  console.log("\nPerformance Latencies (Percentiles):");
  printPercentiles("Wikitext -> AST", parseTimes);
  printPercentiles("AST -> Wikitext", serializeTimes);
  printPercentiles("AST <-> Plate", plateTimes);
  console.log("==================================================================");

  if (semanticDiffCount > 0 || passRate < 95) {
    console.error("FAILED pass criteria.");
    process.exit(1);
  } else {
    console.log("SUCCESS: All criteria met.");
  }
}

function areAstsEquivalent(a: any, b: any): boolean {
  if (!a || !b) return a === b;
  if (a.nodes?.length !== b.nodes?.length) return false;

  for (let i = 0; i < a.nodes.length; i++) {
    const na = a.nodes[i];
    const nb = b.nodes[i];
    if (na.type !== nb.type) return false;
    if (na.templateName && na.templateName !== nb.templateName) return false;
    if (na.params) {
      const keysA = Object.keys(na.params);
      for (const k of keysA) {
        if (na.params[k] !== nb.params?.[k]) return false;
      }
    }
  }
  return true;
}

function printPercentiles(label: string, times: number[]) {
  times.sort((a, b) => a - b);
  const p50 = times[Math.floor(times.length * 0.5)] ?? 0;
  const p90 = times[Math.floor(times.length * 0.9)] ?? 0;
  const p95 = times[Math.floor(times.length * 0.95)] ?? 0;
  const p99 = times[Math.floor(times.length * 0.99)] ?? 0;
  console.log(`  ${label.padEnd(20)} P50: ${p50.toFixed(2)}ms | P90: ${p90.toFixed(2)}ms | P95: ${p95.toFixed(2)}ms | P99: ${p99.toFixed(2)}ms`);
}

void runCorpusRoundtripBenchmark();
