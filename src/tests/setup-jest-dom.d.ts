// Jest loads `@testing-library/jest-dom` at runtime through src/setupTests.ts
// (setupFilesAfterEnv), which extends the one shared `expect`. These references
// give the type checker the same DOM matchers (toBeInTheDocument,
// toHaveAttribute…) for both ways a test can reach `expect`: the injected
// global (`jest.Matchers`) and `import { expect } from "@jest/globals"`
// (`@jest/expect`'s Matchers), which the global augmentation does not cover.
/// <reference types="@testing-library/jest-dom" />
/// <reference types="@testing-library/jest-dom/jest-globals" />
