# WikiOS Narrator Sentence Splitting & ONNX Optimizations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Optimize the WikiOS narrator's local container performance and implement backend sentence-level splitting, caching, and merging in the TTS API proxy route to reduce compute latency, prevent memory crashes, and dramatically raise cache hits.

**Architecture:**
1. Configure optimal ONNX execution variables in `docker-compose.yml` for the local Kokoro container.
2. Implement sentence-splitting heuristics and parallel cache checking in the TTS proxy route (`src/app/api/onoma/tts/route.ts`).
3. Add WAV and MP3 byte-level audio buffer merging utilities to recombine synthesized sentence fragments.
4. Verify the end-to-end integration and run full backend tests.

**Tech Stack:** Next.js 16 (App Router), Node.js, PyTorch/ONNX Runtime, Jest, Docker Compose.

## Global Constraints
* Active branch: `v2`
* Package manager: `bun` (never npm/yarn/pnpm)
* Enforce ≤700 lines per file
* Maintain full backward compatibility for `/api/onoma/tts` client callers (no frontend changes required)

---

### Task 1: Optimize Local Container ONNX Threading

**Files:**
- Modify: `docker-compose.yml`

- [ ] **Step 1: Add ONNX runtime configuration variables**
  Add the optimal ONNX threading configuration variables to the `environment` section of the `kokoro` service in `docker-compose.yml`:
  ```yaml
      environment:
        - ONNX_NUM_THREADS=2
        - ONNX_INTER_OP_THREADS=2
        - ONNX_EXECUTION_MODE=parallel
        - ONNX_OPTIMIZATION_LEVEL=all
  ```
  This caps thread scaling to prevent CPU thrashing on 2-core hosts.

- [ ] **Step 2: Apply compose updates**
  Run: `docker compose up -d kokoro`
  Expected: Container recreates and restarts successfully.

- [ ] **Step 3: Commit Task 1 changes**
  (Note: If `docker-compose.yml` is gitignored, verify change exists locally; otherwise stage it if untracked).

---

### Task 2: Implement Sentence Splitting and Audio Merging in the TTS Proxy Route

**Files:**
- Modify: `src/app/api/onoma/tts/route.ts`
- Modify: `src/app/api/onoma/tts/__tests__/route.test.ts`

**Interfaces:**
- Consumes: `/api/onoma/tts` route parameters
- Produces: Merged audio WAV/MP3 buffer response

- [ ] **Step 1: Write text splitting and audio merging utilities**
  Edit `src/app/api/onoma/tts/route.ts` to implement sentence-splitting regex (respecting decimals and standard abbreviations) and audio buffer merging for both WAV and MP3 formats.
  
  Add to the top section:
  ```typescript
  /** Splits paragraphs into individual sentences respecting abbreviations and decimals */
  function splitIntoSentences(text: string): string[] {
    const abbrevs = /\b(St|Dr|Mr|Mrs|Ms|Gen|Col|Lt|Gov|Sen|Rep|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec|v)\./i;
    const rawSegments = text.match(/[^.!?]+[.!?]+|\s*[^.!?]+$/g) || [text];
    const sentences: string[] = [];

    let current = "";
    for (const segment of rawSegments) {
      current += segment;
      if (abbrevs.test(current.trim())) {
        continue;
      }
      sentences.push(current.trim());
      current = "";
    }
    if (current.trim()) {
      sentences.push(current.trim());
    }
    return sentences.map((s) => s.trim()).filter(Boolean);
  }

  /** Merges multiple WAV buffers by combining PCM data and updating the main RIFF header */
  function mergeWavBuffers(buffers: Buffer[]): Buffer {
    if (buffers.length === 0) return Buffer.alloc(0);
    if (buffers.length === 1) return buffers[0];

    let totalDataSize = 0;
    buffers.forEach((buf) => {
      // 44 bytes is standard WAV header size
      if (buf.length > 44) totalDataSize += buf.length - 44;
    });

    const merged = Buffer.alloc(44 + totalDataSize);
    buffers[0].copy(merged, 0, 0, 44);

    const totalFileSize = 44 + totalDataSize - 8;
    merged.writeUInt32LE(totalFileSize, 4);
    merged.writeUInt32LE(totalDataSize, 40);

    let offset = 44;
    buffers.forEach((buf) => {
      if (buf.length > 44) {
        buf.copy(merged, offset, 44, buf.length);
        offset += buf.length - 44;
      }
    });

    return merged;
  }

  /** Merges multiple MP3 buffers by direct concatenation */
  function mergeMp3Buffers(buffers: Buffer[]): Buffer {
    return Buffer.concat(buffers);
  }
  ```

- [ ] **Step 2: Update handleTts to process sentence segments**
  Update the main `handleTts` logic to split text into sentences, load them concurrently from the cache, synthesize any missing segments, write them back to cache, and merge the final buffers.
  
  Replace the fetch and caching block inside `handleTts`:
  ```typescript
    // Split incoming text into sentences
    const sentences = splitIntoSentences(text);

    if (sentences.length === 0) {
      return NextResponse.json({ error: "Text parameter contains no speakable content" }, { status: 400 });
    }

    const audioBuffers: Buffer[] = [];
    let isWav = engine === "kokoro-fastapi" && ipa && normalizedFastApiUrl;

    for (const sentence of sentences) {
      // Generate individual cache key per sentence segment
      const cacheKey =
        "onoma:tts:segment:" +
        crypto
          .createHash("sha1")
          .update(`${engine}|${sentence}|${ipa}|${voice}|${speed}|${model}`)
          .digest("hex");

      let sentenceBuf: Buffer | null = null;
      let sentenceCt = isWav ? "audio/wav" : "audio/mpeg";

      // 1. Check cache
      if (!isTestingOverrides) {
        const cached = readCached(await globalCache.get<string>(cacheKey));
        if (cached) {
          sentenceBuf = Buffer.from(cached.data, "base64");
          sentenceCt = cached.ct;
          if (sentenceCt === "audio/wav") isWav = true;
          else if (sentenceCt === "audio/mpeg") isWav = false;
        }
      }

      // 2. Synthesize if cache miss
      if (!sentenceBuf) {
        if (engine === "kokoro-fastapi" && ipa && normalizedFastApiUrl) {
          const { phonemes } = ipaToKokoroPhonemes(ipa);
          if (phonemes) {
            try {
              const fastApiBase = normalizedFastApiUrl.replace(/\/$/, "");
              const fastRes = await fetch(`${fastApiBase}/dev/generate_from_phonemes`, {
                method: "POST",
                headers: authHeaders,
                body: JSON.stringify({ phonemes, voice }),
                signal: AbortSignal.timeout(60000),
              });
              if (fastRes.ok) {
                sentenceBuf = Buffer.from(await fastRes.arrayBuffer());
                sentenceCt = fastRes.headers.get("content-type") || "audio/wav";
                isWav = sentenceCt.includes("wav");
              }
            } catch (e) {
              console.warn("[Kokoro FastAPI Segment] Failed, falling back to kokoro-web", e);
            }
          }
        }

        // Fallback or kokoro-web plain-text synthesis
        if (!sentenceBuf) {
          if (!normalizedBaseUrl) {
            return NextResponse.json(
              { error: "Kokoro natural voice service fallback is not configured" },
              { status: 503 }
            );
          }
          const cleanBaseUrl = normalizedBaseUrl
            .replace(/\/$/, "")
            .replace(/\/api$/, "")
            .replace(/\/v1$/, "");
          const ttsUrl =
            engine === "kokoro-fastapi"
              ? `${cleanBaseUrl}/v1/audio/speech`
              : `${cleanBaseUrl}/api/v1/audio/speech`;
          const input = ipaToSpokenText(ipa) || sentence;
          const reqBody = { model, voice, input, response_format: "mp3", speed };

          const response = await fetch(ttsUrl, {
            method: "POST",
            headers: authHeaders,
            body: JSON.stringify(reqBody),
            signal: AbortSignal.timeout(60000),
          });

          if (response.ok) {
            sentenceBuf = Buffer.from(await response.arrayBuffer());
            sentenceCt = "audio/mpeg";
            isWav = false;
          } else {
            const errorText = await response.text();
            console.error(`[Kokoro TTS API Segment Error] status=${response.status}`, errorText);
            return NextResponse.json(
              { error: `Kokoro API returned error status ${response.status} for segment` },
              { status: 502 }
            );
          }
        }

        // Write sentence cache
        if (sentenceBuf && !isTestingOverrides) {
          await globalCache.set(
            cacheKey,
            JSON.stringify({ d: sentenceBuf.toString("base64"), ct: sentenceCt }),
            { ttl: 30 * 24 * 60 * 60, tier: "standard" }
          );
        }
      }

      if (sentenceBuf) {
        audioBuffers.push(sentenceBuf);
      }
    }

    // Merge audio buffers based on the resolved content type
    const finalBuffer = isWav ? mergeWavBuffers(audioBuffers) : mergeMp3Buffers(audioBuffers);
    const contentType = isWav ? "audio/wav" : "audio/mpeg";

    return new NextResponse(finalBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(finalBuffer.length),
      },
    });
  ```

- [ ] **Step 3: Add unit tests for splitter and merger**
  Update `src/app/api/onoma/tts/__tests__/route.test.ts` to include unit tests validating sentence splitting correctness and audio merging functionality.

- [ ] **Step 4: Verify test suite**
  Run: `bun run test -- src/app/api/onoma/tts/__tests__/route.test.ts`
  Expected: PASS

- [ ] **Step 5: Commit changes**
  Commit the changes as: `feat(onoma): implement sentence-level splitting, caching, and audio merging in TTS proxy`
