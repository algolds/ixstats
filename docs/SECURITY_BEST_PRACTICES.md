# Security Best Practices for IxStats Development

**Last Updated**: October 2025
**Version**: 0.98

This guide provides security best practices for developers working on IxStats. Following these guidelines ensures the platform maintains its **A+ security rating**.

---

## 1. Environment & Secrets Management

### ✅ DO:
- Use `.env.local` for development secrets (gitignored)
- Use `.env.production` for production secrets (gitignored)
- Reference environment variables via `src/env.js` for type safety
- Use the provided `.env.example` as a template

### ❌ DON'T:
- Never commit `.env` files with real credentials
- Never hardcode API keys, tokens, or passwords in source code
- Never log sensitive information (passwords, tokens, full credit cards)
- Never expose server-side secrets to client-side code

### Example:
```typescript
// ✅ GOOD: Use env.js
import { env } from "~/env";
const apiKey = env.CLERK_SECRET_KEY;

// ❌ BAD: Hardcoded secret
const apiKey = "sk_live_abc123...";

// ❌ BAD: Direct process.env (not type-safe)
const apiKey = process.env.CLERK_SECRET_KEY;
```

---

## 2. Authentication & Authorization

### ✅ DO:
- Use Clerk middleware for all protected routes
- Check user ownership before allowing data access
- Use appropriate tRPC procedures: `publicProcedure`, `protectedProcedure`, `adminProcedure`
- Validate user roles and permissions in middleware

### ❌ DON'T:
- Never trust client-side authentication checks alone
- Never bypass authorization middleware for "convenience"
- Never implement custom JWT verification (use Clerk)
- Never expose admin endpoints without proper role checks

### Example:
```typescript
// ✅ GOOD: Proper authorization
export const updateCountry = countryOwnerProcedure
  .input(z.object({ countryId: z.string().uuid() }))
  .mutation(async ({ input, ctx }) => {
    // ctx.country already validated by middleware
    return ctx.db.country.update({
      where: { id: ctx.country.id },
      data: { /* ... */ }
    });
  });

// ❌ BAD: No authorization
export const updateCountry = publicProcedure
  .mutation(async ({ input, ctx }) => {
    // Anyone can update any country!
    return ctx.db.country.update({ /* ... */ });
  });
```

---

## 3. Input Validation

### ✅ DO:
- Validate **all** user input with Zod schemas
- Use strict types (UUID, email, URL) when applicable
- Set reasonable min/max limits on strings and numbers
- Validate enums to prevent invalid values
- Sanitize user-generated content before rendering

### ❌ DON'T:
- Never trust client-side validation alone
- Never skip input validation for "internal" endpoints
- Never use loose types (`.string()` without constraints)
- Never pass raw user input to database queries

### Example:
```typescript
// ✅ GOOD: Strict validation
.input(z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  age: z.number().int().min(0).max(150),
  role: z.enum(['USER', 'ADMIN', 'MODERATOR']),
  countryId: z.string().uuid()
}))

// ❌ BAD: Loose validation
.input(z.object({
  name: z.string(), // No limits!
  email: z.string(), // Not validated!
  age: z.number(), // Could be negative!
  role: z.string(), // Any string accepted!
}))
```

---

## 4. Database Security

### ✅ DO:
- Use Prisma ORM for all database queries
- Filter queries by user ownership (`where: { userId: ctx.user.id }`)
- Use transactions for multi-step operations
- Include only necessary fields in queries
- Use proper database indexes for performance

### ❌ DON'T:
- Never use raw SQL queries (Prisma prevents SQL injection)
- Never expose full database records without filtering
- Never allow users to query other users' data
- Never skip ownership checks

### Example:
```typescript
// ✅ GOOD: Filtered by ownership
await ctx.db.post.findMany({
  where: {
    authorId: ctx.user.id, // Only user's posts
  },
  select: {
    id: true,
    title: true,
    content: true,
    // Don't expose internal fields
  }
});

// ❌ BAD: Exposes all posts
await ctx.db.post.findMany({
  // No filtering! All posts exposed!
});
```

---

## 5. Rate Limiting

### ✅ DO:
- Use the built-in `rateLimitMiddleware` for new endpoints
- Set stricter limits for mutation operations
- Monitor rate limit violations in logs
- Provide clear error messages when limits are exceeded

### ❌ DON'T:
- Never disable rate limiting in production
- Never set extremely high limits without analysis
- Never ignore rate limit violations

### Example:
```typescript
// ✅ GOOD: Rate limiting enabled (automatic)
export const createPost = protectedProcedure
  .input(/* ... */)
  .mutation(async ({ input, ctx }) => {
    // Rate limiting automatically applied
    return ctx.db.post.create({ /* ... */ });
  });

// Rate limiting configuration in .env
RATE_LIMIT_ENABLED="true"
RATE_LIMIT_MAX_REQUESTS="100"
RATE_LIMIT_WINDOW_MS="60000"
```

---

## 6. Error Handling

### ✅ DO:
- Use structured error messages
- Log errors with context (user ID, action, timestamp)
- Return generic error messages to clients
- Use audit logging for security-related errors

### ❌ DON'T:
- Never expose stack traces to clients in production
- Never log sensitive data in error messages
- Never return database errors directly to clients
- Never ignore errors silently

### Example:
```typescript
// ✅ GOOD: Safe error handling
try {
  await ctx.db.country.update({ /* ... */ });
} catch (error) {
  console.error('[Update Country] Error:', {
    userId: ctx.user.id,
    countryId: input.countryId,
    error: error.message, // Don't log full error
  });
  throw new TRPCError({
    code: 'INTERNAL_SERVER_ERROR',
    message: 'Failed to update country', // Generic message
  });
}

// ❌ BAD: Exposing internal details
throw new TRPCError({
  message: error.stack, // Stack trace exposed!
});
```

---

## 7. Audit Logging

### ✅ DO:
- Use `auditLogMiddleware` for sensitive operations
- Log all high-security events (admin actions, data exports)
- Include user ID, IP, timestamp, and action
- Persist logs to database for critical events
- Review logs regularly for suspicious activity

### ❌ DON'T:
- Never log sensitive user data (passwords, tokens)
- Never disable audit logging
- Never expose audit logs to non-admin users

---

## 8. API Design

### ✅ DO:
- Use tRPC for type-safe APIs
- Version your API procedures if making breaking changes
- Document all procedures with JSDoc comments
- Use meaningful procedure names
- Group related procedures in routers

### ❌ DON'T:
- Never expose internal implementation details
- Never return more data than necessary
- Never create "god procedures" that do too much

### Example:
```typescript
// ✅ GOOD: Clear, focused procedure
/**
 * Update a country's basic information
 * Requires country ownership
 */
export const updateBasicInfo = countryOwnerProcedure
  .input(z.object({
    name: z.string().min(1).max(100),
    capital: z.string().min(1).max(100)
  }))
  .mutation(async ({ input, ctx }) => {
    return ctx.db.country.update({
      where: { id: ctx.country.id },
      data: {
        name: input.name,
        capital: input.capital,
        updatedAt: new Date()
      }
    });
  });
```

---

## 9. Client-Side Security

### ✅ DO:
- Use Clerk's `<SignedIn>` and `<SignedOut>` components
- Validate user permissions on both client and server
- Sanitize user-generated HTML content
- Use React's built-in XSS protection

### ❌ DON'T:
- Never store sensitive data in localStorage
- Never trust client-side permission checks alone
- Never use `dangerouslySetInnerHTML` without sanitization
- Never expose API keys or secrets in client code

---

## 10. Dependency Security

### ✅ DO:
- Keep dependencies updated regularly
- Review dependency updates for breaking changes
- Use `npm audit` to check for vulnerabilities
- Monitor security advisories for critical packages

### ❌ DON'T:
- Never ignore `npm audit` warnings
- Never use deprecated or unmaintained packages
- Never install dependencies from untrusted sources

---

## 11. Production Deployment

### ✅ Pre-Deployment Checklist:
- [ ] All environment variables configured
- [ ] Clerk live keys (pk_live_*, sk_live_*) configured
- [ ] Database connection tested
- [ ] Redis configured for rate limiting
- [ ] Discord webhooks configured for monitoring
- [ ] HTTPS enforced
- [ ] Security headers enabled
- [ ] Rate limiting enabled
- [ ] Audit logging active
- [ ] Error monitoring configured

### ❌ DON'T:
- Never deploy with test/dev credentials
- Never disable security features for "performance"
- Never expose debug endpoints in production

---

## 12. Security Review Checklist

Use this checklist when adding new features:

### Authentication & Authorization:
- [ ] Protected routes use appropriate middleware
- [ ] User ownership validated for all data access
- [ ] Admin actions require admin role
- [ ] Session handling is secure

### Input Validation:
- [ ] All inputs validated with Zod schemas
- [ ] String lengths limited appropriately
- [ ] Numeric values have min/max bounds
- [ ] Enums used for fixed value sets
- [ ] UUIDs validated for ID fields

### Database Security:
- [ ] All queries use Prisma ORM
- [ ] Queries filtered by user ownership
- [ ] No sensitive data exposed unnecessarily
- [ ] Proper indexes for performance

### Error Handling:
- [ ] Errors logged with context
- [ ] Generic error messages for clients
- [ ] No stack traces in production
- [ ] Security events audit logged

### Rate Limiting:
- [ ] Endpoints properly rate limited
- [ ] Mutation limits stricter than queries
- [ ] Rate limit violations monitored

---

## 13. Common Security Mistakes to Avoid

### 1. **Trusting Client Input**
```typescript
// ❌ BAD
const userId = request.body.userId; // Trusting client!
await db.user.delete({ where: { id: userId } });

// ✅ GOOD
const userId = ctx.user.id; // From authenticated session
await db.user.delete({ where: { id: userId } });
```

### 2. **Missing Authorization Checks**
```typescript
// ❌ BAD
export const deletePost = protectedProcedure
  .input(z.object({ postId: z.string() }))
  .mutation(async ({ input, ctx }) => {
    // No ownership check!
    return ctx.db.post.delete({ where: { id: input.postId } });
  });

// ✅ GOOD
export const deletePost = protectedProcedure
  .input(z.object({ postId: z.string() }))
  .mutation(async ({ input, ctx }) => {
    const post = await ctx.db.post.findUnique({
      where: { id: input.postId }
    });

    if (post.authorId !== ctx.user.id) {
      throw new TRPCError({ code: 'FORBIDDEN' });
    }

    return ctx.db.post.delete({ where: { id: input.postId } });
  });
```

### 3. **Exposing Sensitive Data**
```typescript
// ❌ BAD
return ctx.db.user.findMany({
  include: {
    password: true, // Exposed!
    internalNotes: true, // Exposed!
  }
});

// ✅ GOOD
return ctx.db.user.findMany({
  select: {
    id: true,
    name: true,
    email: true,
    // Only public fields
  }
});
```

---

## 14. Security Resources

### Internal Documentation:
- [SECURITY_AUDIT_REPORT.md](../SECURITY_AUDIT_REPORT.md) - Comprehensive security audit
- [PRODUCTION_READY.md](../PRODUCTION_READY.md) - Production deployment guide

### External Resources:
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Clerk Security Documentation](https://clerk.com/docs/security)
- [Prisma Security Best Practices](https://www.prisma.io/docs/guides/performance-and-optimization/security)
- [Next.js Security](https://nextjs.org/docs/app/building-your-application/configuring/content-security-policy)

---

## 15. Reporting Security Issues

If you discover a security vulnerability:

1. **DO NOT** open a public GitHub issue
2. Email security contact: [Add email here]
3. Include detailed description and reproduction steps
4. Allow time for fix before public disclosure

---

## Conclusion

Security is everyone's responsibility. By following these best practices, we maintain IxStats' **A+ security rating** and protect our users' data.

**Remember**: When in doubt, choose security over convenience.

---

**Document Version**: 1.0
**Last Updated**: October 2025
**Next Review**: January 2026
