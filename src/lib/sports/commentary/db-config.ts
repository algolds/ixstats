export async function getGlobalLLMConfig(prisma: any) {
  try {
    const configs = await prisma.systemConfig.findMany({
      where: {
        key: {
          in: [
            "sports:llm:provider",
            "sports:llm:apiKey",
            "sports:llm:apiUrl",
            "sports:llm:modelName",
            "sports:llm:temperature",
            "sports:llm:applyGlobally",
          ],
        },
      },
    });

    const applyGlobally =
      configs.find((c: any) => c.key === "sports:llm:applyGlobally")?.value === "true";
    if (!applyGlobally) return undefined;

    const provider = configs.find((c: any) => c.key === "sports:llm:provider")?.value;
    const apiKey = configs.find((c: any) => c.key === "sports:llm:apiKey")?.value;
    const apiUrl = configs.find((c: any) => c.key === "sports:llm:apiUrl")?.value;
    const modelName = configs.find((c: any) => c.key === "sports:llm:modelName")?.value;
    const tempVal = configs.find((c: any) => c.key === "sports:llm:temperature")?.value;

    if (!apiKey) return undefined;

    return {
      provider: provider || undefined,
      apiKey: apiKey || undefined,
      apiUrl: apiUrl || undefined,
      modelName: modelName || undefined,
      temperature: tempVal ? parseFloat(tempVal) : undefined,
    };
  } catch (e) {
    console.error("[sports-narrator] Failed to load global LLM config from db:", e);
    return undefined;
  }
}
