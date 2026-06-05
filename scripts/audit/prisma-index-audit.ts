import * as fs from "fs";
import * as path from "path";

const SCHEMA_DIR = "/ixwiki/public/projects/ixstats/prisma/schema";

interface ModelInfo {
  name: string;
  fields: { name: string; type: string; isId: boolean; isUnique: boolean }[];
  relations: { fields: string[]; references: string[]; relationName?: string }[];
  indexes: string[][];
  uniques: string[][];
  ids: string[][];
}

function parsePrismaFiles(): ModelInfo[] {
  const files = fs.readdirSync(SCHEMA_DIR).filter((f) => f.endsWith(".prisma"));
  const models: ModelInfo[] = [];

  for (const file of files) {
    const content = fs.readFileSync(path.join(SCHEMA_DIR, file), "utf-8");
    const lines = content.split("\n");
    let currentModel: ModelInfo | null = null;

    for (let line of lines) {
      line = line.trim();
      if (line.startsWith("model ")) {
        const modelName = line.split(/\s+/)[1];
        currentModel = {
          name: modelName,
          fields: [],
          relations: [],
          indexes: [],
          uniques: [],
          ids: [],
        };
      } else if (line === "}") {
        if (currentModel) {
          models.push(currentModel);
          currentModel = null;
        }
      } else if (currentModel) {
        // Parse block level attributes
        if (line.startsWith("@@index")) {
          const match = line.match(/@@index\(\[([^\]]+)\]/);
          if (match) {
            const fields = match[1].split(",").map((f) => f.trim().replace(/:\s*\w+/, ""));
            currentModel.indexes.push(fields);
          }
        } else if (line.startsWith("@@unique")) {
          const match = line.match(/@@unique\(\[([^\]]+)\]/);
          if (match) {
            const fields = match[1].split(",").map((f) => f.trim());
            currentModel.uniques.push(fields);
          }
        } else if (line.startsWith("@@id")) {
          const match = line.match(/@@id\(\[([^\]]+)\]/);
          if (match) {
            const fields = match[1].split(",").map((f) => f.trim());
            currentModel.ids.push(fields);
          }
        } else if (line && !line.startsWith("//")) {
          // Parse field
          const parts = line.split(/\s+/);
          if (parts.length >= 2) {
            const fieldName = parts[0];
            const fieldType = parts[1];
            const isId = line.includes("@id");
            const isUnique = line.includes("@unique");

            currentModel.fields.push({
              name: fieldName,
              type: fieldType,
              isId,
              isUnique,
            });

            if (line.includes("@relation")) {
              const relationMatch = line.match(/fields:\s*\[([^\]]+)\]/);
              const refMatch = line.match(/references:\s*\[([^\]]+)\]/);
              if (relationMatch && refMatch) {
                const fields = relationMatch[1].split(",").map((f) => f.trim());
                const references = refMatch[1].split(",").map((f) => f.trim());
                currentModel.relations.push({ fields, references });
              }
            }
          }
        }
      }
    }
  }

  return models;
}

function auditModels(models: ModelInfo[]) {
  console.log("=== Prisma Foreign Key Index Audit ===\n");
  let missingIndexCount = 0;

  for (const model of models) {
    const modelMissing: string[] = [];

    for (const relation of model.relations) {
      const relFields = relation.fields;
      if (relFields.length === 0) continue;

      // Check if relation fields are indexed/unique/primary key
      let isCovered = false;

      // 1. Check if single relation field is marked @id or @unique in field definition
      if (relFields.length === 1) {
        const fieldName = relFields[0];
        const field = model.fields.find((f) => f.name === fieldName);
        if (field && (field.isId || field.isUnique)) {
          isCovered = true;
        }
      }

      // 2. Check if the relation fields are a prefix of any composite ID, unique constraint, or index
      if (!isCovered) {
        const checkPrefix = (indexFields: string[]) => {
          if (indexFields.length < relFields.length) return false;
          for (let i = 0; i < relFields.length; i++) {
            if (indexFields[i] !== relFields[i]) return false;
          }
          return true;
        };

        // Check composite IDs
        for (const idFields of model.ids) {
          if (checkPrefix(idFields)) {
            isCovered = true;
            break;
          }
        }

        // Check composite uniques
        if (!isCovered) {
          for (const uniqFields of model.uniques) {
            if (checkPrefix(uniqFields)) {
              isCovered = true;
              break;
            }
          }
        }

        // Check indexes
        if (!isCovered) {
          for (const idxFields of model.indexes) {
            if (checkPrefix(idxFields)) {
              isCovered = true;
              break;
            }
          }
        }
      }

      if (!isCovered) {
        modelMissing.push(
          `[${relFields.join(", ")}] referencing [${relation.references.join(", ")}]`
        );
        missingIndexCount++;
      }
    }

    if (modelMissing.length > 0) {
      console.log(`Model: ${model.name}`);
      for (const missing of modelMissing) {
        console.log(`  ⚠️ Missing index for relation fields: ${missing}`);
      }
      console.log();
    }
  }

  console.log(`Total missing relation indexes: ${missingIndexCount}`);
}

const models = parsePrismaFiles();
auditModels(models);
