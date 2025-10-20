# Schema Validation Developer Guide

**Last updated:** October 2025

This guide provides comprehensive instructions for maintaining 100% schema alignment between Prisma models and Zod validation schemas in the IxStats platform.

## Overview

The IxStats platform uses a dual-validation approach:
- **Prisma models** define the database schema with types, constraints, and relationships
- **Zod schemas** provide runtime validation for tRPC endpoints

Maintaining alignment between these two systems is critical for preventing runtime errors like "column `isActive` does not exist" and ensuring data integrity.

## Schema Pattern Standards

### 1. Create/Update/Response Schema Pattern

For each model that requires CRUD operations, implement three schema types:

```typescript
// Base schema with all fields
const modelBaseSchema = z.object({
  // All model fields with proper validation
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  isActive: z.boolean().default(true),
  // ... other fields
});

// Create schema - all required fields with defaults
const modelCreateSchema = modelBaseSchema;

// Update schema - all fields optional
const modelUpdateSchema = modelBaseSchema.partial();

// Response schema - matches Prisma model exactly (for type safety)
const modelResponseSchema = modelBaseSchema;
```

### 2. Common Field Validation

Standardize validation for recurring fields across all schemas:

```typescript
// Standard field validations
const commonFields = {
  isActive: z.boolean().default(true),
  countryId: z.string().min(1, "Country ID is required"),
  userId: z.string().min(1, "User ID is required"),
  createdAt: z.date().optional(), // Auto-managed, exclude from input schemas
  updatedAt: z.date().optional(), // Auto-managed, exclude from input schemas
};
```

### 3. Field Type Mappings

Ensure proper type alignment between Prisma and Zod:

| Prisma Type | Zod Type | Notes |
|-------------|----------|-------|
| `String` | `z.string()` | Use `.min(1)` for required strings |
| `Int` | `z.number().int()` | Use `.nonnegative()` for counts |
| `Float` | `z.number()` | Use `.min(0)` for positive values |
| `Boolean` | `z.boolean()` | Use `.default(true)` for isActive |
| `DateTime` | `z.date()` | Exclude from input schemas |
| `Json` | `z.record()` or `z.array()` | Use appropriate JSON validation |

## Development Workflow

### 1. Adding New Models

When adding a new Prisma model:

1. **Define the Prisma model** in `prisma/schema.prisma`
2. **Create corresponding Zod schemas** following the pattern above
3. **Add tRPC procedures** using the appropriate schemas
4. **Run validation** to ensure alignment

```bash
# Check schema alignment
npm run validate:schemas

# Check CRUD coverage
npm run audit:coverage

# Run full test suite
npm run test:all
```

### 2. Modifying Existing Models

When modifying existing models:

1. **Update Prisma schema** with new fields
2. **Update corresponding Zod schemas** to include new fields
3. **Run migration** to update database
4. **Validate alignment** before committing

```bash
# Generate and apply migration
npx prisma migrate dev --name add_new_field

# Validate schema alignment
npm run validate:schemas

# Test CRUD operations
npm run test:crud
```

### 3. Adding New tRPC Endpoints

When adding new tRPC endpoints:

1. **Use appropriate schema** (create vs update)
2. **Validate input** with Zod before database operations
3. **Avoid spread operators** without explicit validation
4. **Test thoroughly** with edge cases

```typescript
// ✅ Good: Explicit validation
createModel: protectedProcedure
  .input(z.object({
    countryId: z.string(),
    data: modelCreateSchema,
  }))
  .mutation(async ({ ctx, input }) => {
    return ctx.db.model.create({
      data: {
        countryId: input.countryId,
        ...input.data, // Safe because data is validated
      },
    });
  });

// ❌ Bad: Spread without validation
createModel: protectedProcedure
  .input(z.object({
    countryId: z.string(),
    data: z.any(), // No validation!
  }))
  .mutation(async ({ ctx, input }) => {
    return ctx.db.model.create({
      data: input.data, // Unsafe!
    });
  });
```

## Validation Scripts

### 1. Schema Alignment Validation

```bash
npm run validate:schemas
```

**Purpose:** Detects mismatches between Prisma models and Zod schemas.

**Checks:**
- Missing fields in Zod schemas
- Type mismatches between Prisma and Zod
- Default value discrepancies
- Spread operator usage without validation

**Output:** Critical issues must be resolved, warnings should be reviewed.

### 2. CRUD Coverage Audit

```bash
npm run audit:coverage
```

**Purpose:** Ensures all user-facing models have proper CRUD operations.

**Checks:**
- Model-to-endpoint coverage mapping
- Missing CRUD operations for critical models
- Coverage percentage by model and router

**Output:** Detailed coverage report with recommendations.

### 3. Migration Safety Validation

```bash
npm run validate:migrations
```

**Purpose:** Validates migration safety and schema drift.

**Checks:**
- Pending migrations
- Schema drift between environments
- Breaking changes in migrations
- Model table existence

**Output:** Migration safety report with recommendations.

### 4. Database Integrity Checks

```bash
npm run test:db
```

**Purpose:** Validates database integrity and relationships.

**Checks:**
- Referential integrity
- isActive field consistency
- Orphaned records
- Data consistency

**Output:** Database health report with issues and recommendations.

## Common Issues and Solutions

### 1. Missing isActive Field

**Error:** `column 'isActive' does not exist`

**Solution:**
```typescript
// Add isActive to Zod schema
const modelBaseSchema = z.object({
  // ... other fields
  isActive: z.boolean().default(true),
});
```

### 2. Type Mismatches

**Error:** Type validation failures

**Solution:**
```typescript
// Ensure proper type mapping
const modelSchema = z.object({
  count: z.number().int().nonnegative(), // Prisma Int -> Zod number().int()
  price: z.number().nonnegative(),        // Prisma Float -> Zod number()
  active: z.boolean().default(true),     // Prisma Boolean -> Zod boolean()
});
```

### 3. Spread Operator Issues

**Error:** Spread operator used without validation

**Solution:**
```typescript
// Use validated schemas instead of spread
const validatedData = modelCreateSchema.parse(input.data);
return ctx.db.model.create({ data: validatedData });
```

### 4. Missing CRUD Operations

**Error:** Model has no CRUD endpoints

**Solution:**
1. Identify missing operations from coverage report
2. Add appropriate tRPC procedures
3. Use proper schema patterns
4. Test thoroughly

## Best Practices

### 1. Schema Design

- **Always include `isActive`** for models that need soft delete
- **Use appropriate defaults** for optional fields
- **Validate required fields** with proper constraints
- **Exclude auto-managed fields** (createdAt, updatedAt) from input schemas

### 2. tRPC Procedures

- **Use create/update schemas** appropriately
- **Validate all inputs** before database operations
- **Avoid spread operators** without explicit validation
- **Test edge cases** thoroughly

### 3. Testing

- **Run validation scripts** before committing
- **Test CRUD operations** for all new models
- **Verify schema alignment** after changes
- **Check database integrity** regularly

### 4. Maintenance

- **Review validation reports** regularly
- **Update schemas** when Prisma models change
- **Monitor coverage** for new models
- **Fix issues promptly** to prevent accumulation

## Integration with CI/CD

### Pre-commit Validation

Add to your pre-commit hooks:

```bash
# Validate schemas before commit
npm run validate:schemas

# Check CRUD coverage
npm run audit:coverage

# Run critical tests
npm run test:critical
```

### CI/CD Pipeline

Include in your CI/CD pipeline:

```yaml
# Example GitHub Actions workflow
- name: Validate Schema Alignment
  run: npm run validate:schemas

- name: Check CRUD Coverage
  run: npm run audit:coverage

- name: Run Full Test Suite
  run: npm run test:all
```

## Troubleshooting

### 1. Validation Scripts Fail

**Check:**
- Node.js version compatibility
- TypeScript compilation
- Database connection
- File permissions

### 2. Schema Mismatches

**Common causes:**
- Missing fields in Zod schemas
- Type mismatches between Prisma and Zod
- Default value discrepancies
- Spread operator usage

### 3. Coverage Issues

**Common causes:**
- Missing CRUD operations
- Incorrect model categorization
- Router configuration issues
- Test data problems

### 4. Migration Issues

**Common causes:**
- Pending migrations
- Schema drift
- Breaking changes
- Database connection issues

## Resources

- [Prisma Schema Reference](https://www.prisma.io/docs/reference/api-reference/prisma-schema-reference)
- [Zod Documentation](https://zod.dev/)
- [tRPC Documentation](https://trpc.io/)
- [IxStats API Reference](../reference/api.md)

## Support

For issues with schema validation:

1. Check this guide for common solutions
2. Review validation script output for specific errors
3. Consult the API reference for schema patterns
4. Contact the development team for complex issues

Remember: Schema validation is critical for preventing runtime errors and ensuring data integrity. Always validate your changes before committing!
