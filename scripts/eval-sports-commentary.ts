import { narrateEvents } from "../src/lib/sports/commentary/narrator";
import type { EventTraceStep } from "../src/lib/sports/resolver";

const fixtures: Record<string, EventTraceStep[]> = {
  soccer: [
    { t: 0, type: "tactic_shift", description: "Match begins. Home team using neutral tactics.", team: "home" },
    { t: 23, type: "goal", description: "GOAL! John Smith fires a shot past the goalie!", team: "home" },
    { t: 45, type: "card", description: "YELLOW CARD: Alex Jones gets booked for a late challenge.", team: "away" }
  ],
  f1: [
    { t: 0, type: "tactic_shift", description: "Race begins under clear skies. Drivers grid up.", team: "home" },
    { t: 15, type: "tactic_shift", description: "COLLISION: Hamilton and Verstappen touch at turn 4!", team: "away" },
    { t: 50, type: "goal", description: "CHEQUERED FLAG: Leclerc wins the race!", team: "home" }
  ],
  boxing: [
    { t: 1, type: "tactic_shift", description: "Round 1 begins. Fighters touch gloves.", team: "home" },
    { t: 2, type: "goal", description: "KNOCKDOWN: Tyson lands a devastating hook and sends Paul to the canvas!", team: "home" },
    { t: 3, type: "goal", description: "DECISION: Tyson wins by Unanimous Decision!", team: "home" }
  ]
};

const candidates = [
  {
    name: "NVIDIA Nemotron 3 Ultra",
    env: {
      SPORTS_LLM_COMMENTARY: "true",
      SPORTS_LLM_PROVIDER: "nvidia",
      SPORTS_LLM_API_KEY: process.env.NVIDIA_API_KEY || process.env.SPORTS_LLM_API_KEY || "",
      SPORTS_LLM_MODEL: "nvidia/nemotron-3-ultra-550b-a55b",
      SPORTS_LLM_API_URL: "https://integrate.api.nvidia.com/v1/chat/completions"
    }
  },
  {
    name: "OpenRouter Llama 3.1 70B",
    env: {
      SPORTS_LLM_COMMENTARY: "true",
      SPORTS_LLM_PROVIDER: "openrouter",
      SPORTS_LLM_API_KEY: process.env.OPENROUTER_API_KEY || "",
      SPORTS_LLM_MODEL: "meta-llama/llama-3.1-70b-instruct",
      SPORTS_LLM_API_URL: "https://openrouter.ai/api/v1/chat/completions"
    }
  },
  {
    name: "OpenAI GPT-4o-Mini Baseline",
    env: {
      SPORTS_LLM_COMMENTARY: "true",
      SPORTS_LLM_PROVIDER: "openai",
      SPORTS_LLM_API_KEY: process.env.OPENAI_API_KEY || "",
      SPORTS_LLM_MODEL: "gpt-4o-mini",
      SPORTS_LLM_API_URL: "https://api.openai.com/v1/chat/completions"
    }
  }
];

async function runEval() {
  console.log("==================================================");
  console.log("        SPORTS COMMENTARY LLM EVALUATION");
  console.log("==================================================\n");

  // Save original environment
  const originalEnv = { ...process.env };

  for (const candidate of candidates) {
    console.log(`>>> Evaluating Candidate: ${candidate.name} ...`);
    
    if (!candidate.env.SPORTS_LLM_API_KEY) {
      console.log(`    Status: SKIPPED (API Key missing)\n`);
      continue;
    }

    // Set candidate environment
    Object.assign(process.env, candidate.env);

    for (const [sport, events] of Object.entries(fixtures)) {
      console.log(`    [Sport: ${sport.toUpperCase()}]`);
      console.log(`      Input:  ${events.map(e => e.description).join(" | ")}`);

      const start = Date.now();
      try {
        const results = await narrateEvents(events, { sport });
        const latency = Date.now() - start;

        console.log(`      Output: ${results.join(" | ")}`);
        console.log(`      Latency: ${latency}ms\n`);
      } catch (err) {
        console.log(`      Failed: ${err instanceof Error ? err.message : String(err)}\n`);
      }
    }

    // Restore environment after each candidate
    process.env = { ...originalEnv };
  }

  // Final smoke check with flag OFF (should run without keys or network)
  console.log(">>> Checking Fallback Mode (SPORTS_LLM_COMMENTARY=false) ...");
  process.env.SPORTS_LLM_COMMENTARY = "false";
  const start = Date.now();
  const fallbackResults = await narrateEvents(fixtures.soccer, { sport: "soccer" });
  const latency = Date.now() - start;
  console.log(`    Output:  ${fallbackResults.join(" | ")}`);
  console.log(`    Latency: ${latency}ms (Expected near 0ms)\n`);
  
  // Restore original environment
  process.env = { ...originalEnv };
  console.log("Evaluation run completed.");
}

runEval().catch(console.error);
