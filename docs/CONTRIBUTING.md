# Contributing to IxStats
**Version 1.1.0**

Thank you for your interest in contributing to IxStats! This document provides guidelines and best practices for contributing to the project.

## Table of Contents
- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Branch Naming Conventions](#branch-naming-conventions)
- [Commit Message Standards](#commit-message-standards)
- [Pull Request Process](#pull-request-process)
- [Code Review Expectations](#code-review-expectations)
- [Testing Requirements](#testing-requirements)
- [Documentation Requirements](#documentation-requirements)
- [Release Process](#release-process)

## Code of Conduct

### Our Pledge

We are committed to providing a welcoming and inclusive environment for all contributors, regardless of experience level, background, or identity.

### Expected Behavior

- **Be Respectful**: Treat all contributors with respect and courtesy
- **Be Constructive**: Provide helpful feedback and accept criticism gracefully
- **Be Collaborative**: Work together toward shared goals
- **Be Professional**: Maintain professionalism in all interactions
- **Be Patient**: Remember that everyone is learning and growing

### Unacceptable Behavior

- Harassment, discrimination, or offensive comments
- Personal attacks or derogatory language
- Spam, trolling, or intentional disruption
- Sharing private information without permission
- Any conduct that creates an unsafe environment

### Enforcement

Violations of the code of conduct should be reported to project maintainers. All reports will be reviewed and investigated promptly and fairly.

## Getting Started

### Prerequisites

Before contributing, ensure you have:

1. **Development environment set up**: See [GETTING_STARTED.md](./GETTING_STARTED.md)
2. **Understanding of the project**: Read [README.md](../README.md) and [CLAUDE.md](../CLAUDE.md)
3. **Familiarity with tech stack**: Next.js 15, TypeScript, tRPC, Prisma
4. **Code standards knowledge**: Review [CODE_STANDARDS.md](./CODE_STANDARDS.md)

### Finding Work

#### Good First Issues

Look for issues labeled:
- `good first issue`: Suitable for new contributors
- `help wanted`: Community contributions welcome
- `documentation`: Documentation improvements needed
- `bug`: Bug fixes needed

#### Feature Requests

Before implementing a new feature:
1. Check if an issue exists for the feature
2. If not, create a feature request issue
3. Wait for maintainer approval before starting work
4. Discuss implementation approach in the issue

## Development Workflow

### 1. Fork and Clone

```bash
# Fork the repository on GitHub
# Then clone your fork
git clone https://github.com/YOUR-USERNAME/ixstats.git
cd ixstats

# Add upstream remote
git remote add upstream https://github.com/ORIGINAL-OWNER/ixstats.git
```

### 2. Create a Branch

```bash
# Update your local main branch
git checkout master
git pull upstream master

# Create a feature branch
git checkout -b feature/your-feature-name
```

### 3. Make Changes

```bash
# Make your changes
# Follow code standards (see CODE_STANDARDS.md)
# Test thoroughly

# Format code
npm run format:write

# Check for errors
npm run check
```

### 4. Commit Changes

```bash
# Stage changes
git add .

# Commit with descriptive message (see commit standards below)
git commit -m "feat: add new economic indicator calculation"
```

### 5. Push to Fork

```bash
# Push your branch to your fork
git push origin feature/your-feature-name
```

### 6. Create Pull Request

1. Go to your fork on GitHub
2. Click "New Pull Request"
3. Select your branch
4. Fill out the PR template
5. Submit for review

### 7. Address Review Feedback

```bash
# Make requested changes
# Commit and push updates
git add .
git commit -m "fix: address review feedback"
git push origin feature/your-feature-name
```

### 8. Merge

Once approved, a maintainer will merge your PR.

## Branch Naming Conventions

Use descriptive branch names following this pattern:

### Format

```
<type>/<short-description>
```

### Types

- **`feature/`**: New features or enhancements
  - Example: `feature/add-budget-calculator`

- **`fix/`**: Bug fixes
  - Example: `fix/economic-data-calculation-error`

- **`refactor/`**: Code refactoring without behavior changes
  - Example: `refactor/simplify-trpc-router-structure`

- **`docs/`**: Documentation updates
  - Example: `docs/update-api-reference`

- **`test/`**: Adding or updating tests
  - Example: `test/add-economic-calculations-tests`

- **`chore/`**: Maintenance tasks, dependency updates
  - Example: `chore/update-dependencies`

- **`perf/`**: Performance improvements
  - Example: `perf/optimize-database-queries`

- **`style/`**: Code style changes (formatting, whitespace)
  - Example: `style/format-components`

### Examples

```bash
# Good branch names
git checkout -b feature/atomic-government-synergy-detection
git checkout -b fix/clerk-authentication-redirect
git checkout -b docs/add-trpc-router-guide
git checkout -b refactor/unify-economic-calculations

# Avoid
git checkout -b patch-1
git checkout -b temp
git checkout -b my-changes
```

## Commit Message Standards

We follow the **Conventional Commits** specification for clear commit history.

### Format

```
<type>(<scope>): <short description>

[optional body]

[optional footer]
```

### Types

- **`feat`**: New feature
- **`fix`**: Bug fix
- **`docs`**: Documentation changes
- **`style`**: Code style changes (no logic changes)
- **`refactor`**: Code refactoring
- **`perf`**: Performance improvements
- **`test`**: Adding or updating tests
- **`chore`**: Maintenance tasks
- **`revert`**: Reverting previous commits

### Scope (Optional)

The scope specifies which part of the codebase is affected:
- `api`: tRPC API changes
- `ui`: UI component changes
- `db`: Database schema changes
- `auth`: Authentication changes
- `builder`: Country builder changes
- `economy`: Economic system changes
- `government`: Government system changes

### Examples

```bash
# Feature
git commit -m "feat(economy): add GDP growth projection calculation"

# Bug fix
git commit -m "fix(auth): resolve Clerk redirect loop on logout"

# Documentation
git commit -m "docs: update environment variables reference"

# Refactoring
git commit -m "refactor(api): simplify countries router structure"

# Performance
git commit -m "perf(db): add index to country economic data queries"

# With body
git commit -m "feat(builder): add atomic government synergy detection

Implements real-time synergy detection between atomic government
components with effectiveness scoring and conflict resolution.

Closes #123"
```

### Commit Message Guidelines

**DO:**
- Use imperative mood ("add" not "added" or "adds")
- Keep first line under 72 characters
- Capitalize first letter
- No period at end of subject line
- Provide detailed body for complex changes
- Reference issue numbers in footer

**DON'T:**
- Use generic messages ("fix bug", "update code")
- Include multiple unrelated changes in one commit
- Commit untested or broken code
- Commit commented-out code

## Pull Request Process

### Before Submitting

1. **Ensure all checks pass**:
   ```bash
   npm run check
   npm run test:health
   ```

2. **Update documentation** if needed

3. **Test thoroughly**:
   - Manual testing
   - Edge cases
   - Different environments

4. **Review your own changes**:
   - Read through the diff
   - Remove debugging code
   - Check for unintended changes

### PR Title Format

Use the same format as commit messages:

```
feat(economy): add GDP growth projection calculation
fix(auth): resolve Clerk redirect loop on logout
docs: update CONTRIBUTING.md with PR guidelines
```

### PR Description Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix (non-breaking change fixing an issue)
- [ ] New feature (non-breaking change adding functionality)
- [ ] Breaking change (fix or feature causing existing functionality to break)
- [ ] Documentation update

## Motivation and Context
Why is this change required? What problem does it solve?

## Testing
- [ ] Tested locally in development
- [ ] Manual testing completed
- [ ] No console errors or warnings
- [ ] Database migrations tested (if applicable)

## Screenshots (if applicable)
Include screenshots for UI changes

## Checklist
- [ ] Code follows project standards (CODE_STANDARDS.md)
- [ ] Comments added for complex logic
- [ ] Documentation updated
- [ ] No new TypeScript errors
- [ ] All tests pass
- [ ] Formatted with Prettier

## Related Issues
Closes #issue-number
```

### PR Size Guidelines

Keep PRs focused and manageable:
- **Small**: < 200 lines changed (ideal)
- **Medium**: 200-500 lines changed (acceptable)
- **Large**: > 500 lines changed (should be rare)

Large PRs should be broken into smaller, logical chunks when possible.

## Code Review Expectations

### For Contributors

**When submitting for review:**
- Provide clear context in PR description
- Self-review your changes first
- Be responsive to feedback
- Accept criticism gracefully
- Make requested changes promptly

**Responding to feedback:**
- Reply to each comment (even if just "Done")
- Ask questions if feedback is unclear
- Explain your reasoning when disagreeing
- Push updates after addressing feedback

### For Reviewers

**What to review:**
- Code correctness and logic
- Adherence to code standards
- Test coverage
- Documentation completeness
- Performance implications
- Security considerations

**How to review:**
- Be constructive and specific
- Explain the "why" behind suggestions
- Acknowledge good work
- Suggest alternatives, don't just criticize
- Approve when ready, request changes when needed

### Review Response Time

- **Critical bugs**: < 24 hours
- **Regular PRs**: < 3 business days
- **Documentation**: < 5 business days

## Testing Requirements

### Before Submitting PR

1. **Manual Testing**:
   ```bash
   # Start development server
   npm run dev

   # Test your changes in browser
   # Try edge cases and error scenarios
   ```

2. **Type Checking**:
   ```bash
   npm run typecheck
   ```

3. **Linting**:
   ```bash
   npm run lint
   ```

4. **Full Validation**:
   ```bash
   npm run check
   ```

5. **API Health Check** (if API changes):
   ```bash
   npm run test:health
   ```

6. **Database Integrity** (if schema changes):
   ```bash
   npm run test:db
   ```

### Database Changes

If you modify `prisma/schema.prisma`:

1. **Create migration**:
   ```bash
   npm run db:migrate
   ```

2. **Test migration**:
   ```bash
   # Reset and reapply
   npm run db:reset
   npm run db:setup
   ```

3. **Include migration files** in PR

### Breaking Changes

If your change breaks existing functionality:

1. **Document breaking changes** in PR description
2. **Provide migration guide** for users
3. **Update CHANGELOG.md**
4. **Mark PR as breaking change**

## Documentation Requirements

### Code Documentation

**Add comments for:**
- Complex algorithms or logic
- Non-obvious decisions
- Workarounds or hacks
- Public API functions

**Example:**
```typescript
/**
 * Calculates GDP growth rate with tier-based caps.
 *
 * Applies global growth factor (3.21%) then caps based on
 * economic tier to model diminishing returns at higher GDP levels.
 *
 * @param baseGDP - Current GDP in USD
 * @param tier - Economic tier (1-7)
 * @returns Projected GDP growth rate as decimal (e.g., 0.05 for 5%)
 */
export function calculateGDPGrowthRate(baseGDP: number, tier: number): number {
  // Implementation...
}
```

### Documentation Files

**Update when:**
- Adding new features
- Changing existing behavior
- Adding environment variables
- Modifying database schema

**Files to update:**
- `README.md`: High-level feature changes
- `CLAUDE.md`: Architecture or system changes
- `docs/*.md`: Specific system documentation
- API comments: tRPC router changes

### README Updates

When adding major features:
1. Update feature list in README.md
2. Add usage examples
3. Update version number if needed
4. Add to CHANGELOG.md

## Release Process

### Version Numbering

We follow **Semantic Versioning** (semver):

- **MAJOR** (1.x.x): Breaking changes
- **MINOR** (x.1.x): New features (backward compatible)
- **PATCH** (x.x.1): Bug fixes

### Release Checklist

1. **Update version**:
   ```bash
   # Update package.json version
   npm version patch|minor|major
   ```

2. **Update CHANGELOG.md**:
   - List all changes since last release
   - Categorize: Features, Fixes, Breaking Changes

3. **Create release tag**:
   ```bash
   git tag -a v1.1.0 -m "Release v1.1.0"
   git push origin v1.1.0
   ```

4. **Build and test**:
   ```bash
   npm run build:fast
   npm run verify:production
   ```

5. **Deploy to production**:
   ```bash
   npm run deploy:prod
   ```

## Tips for Successful Contributions

### Communication

- **Ask questions**: Better to ask than assume
- **Provide context**: Explain your reasoning
- **Be patient**: Reviews take time
- **Stay engaged**: Respond to comments promptly

### Code Quality

- **Follow standards**: See [CODE_STANDARDS.md](./CODE_STANDARDS.md)
- **Write clear code**: Readable > clever
- **Test thoroughly**: Catch bugs early
- **Document well**: Help future maintainers

### Efficiency

- **Small, focused PRs**: Easier to review
- **One feature per PR**: Clear scope
- **Rebase regularly**: Stay up-to-date with main
- **Self-review first**: Catch your own mistakes

## Getting Help

### Resources

- **[GETTING_STARTED.md](./GETTING_STARTED.md)**: Setup guide
- **[CODE_STANDARDS.md](./CODE_STANDARDS.md)**: Coding conventions
- **[TROUBLESHOOTING.md](./TROUBLESHOOTING.md)**: Common issues
- **[ENVIRONMENT_VARIABLES.md](./ENVIRONMENT_VARIABLES.md)**: Environment config

### Contact

- **GitHub Issues**: Technical questions and bug reports
- **Pull Request Comments**: Code-specific questions
- **Project Maintainers**: Architecture and design decisions

## Recognition

We value all contributions! Contributors are recognized in:
- Git commit history
- Release notes
- Project README (for significant contributions)

## Thank You!

Your contributions make IxStats better for everyone. We appreciate your time, effort, and expertise.

---

**Happy Contributing!**

For code standards and best practices, see [CODE_STANDARDS.md](./CODE_STANDARDS.md).
