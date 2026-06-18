/**
 * Auto-generates a draft executive policy/proclamation in the database when new geography is created.
 */
export async function triggerGeographyPolicy(
  db: any,
  countryId: string,
  type: "subdivision" | "city",
  name: string,
  submittedBy?: string
): Promise<void> {
  try {
    const creatorId = submittedBy || "system";
    const title =
      type === "subdivision" ? `Establish Subdivision: ${name}` : `Charter City: ${name}`;
    const desc =
      type === "subdivision"
        ? `Establish administrative, tax, and infrastructure structures for the new subdivision ${name}. This increases regional cohesion but incurs an administrative startup cost.`
        : `Grant municipal charter to the city of ${name}, starting local development programs to spur commerce and population attraction.`;

    await db.policy.create({
      data: {
        countryId,
        userId: creatorId,
        name: title,
        description: desc,
        policyType: "governance",
        category: "governance",
        priority: "medium",
        status: "draft",
        implementationCost: type === "subdivision" ? 500000 : 250000,
        maintenanceCost: type === "subdivision" ? 25000 : 10000,
        objectives: `Enact official administrative control over ${name} to scale regional tax collection and security.`,
        targetMetrics:
          type === "subdivision"
            ? "taxCapacity, politicalStability"
            : "localCommerce, populationFlow",
      },
    });
  } catch (err) {
    console.warn(`[triggerGeographyPolicy] Failed to auto-generate policy for ${name}:`, err);
  }
}
