// ============================================================================
// Global test setup — runs once before every test file
// ============================================================================
//
// We extend Vitest's `expect` with @testing-library matchers (so
// `expect(el).toBeInTheDocument()` works) and provide a stable date
// for deterministic tests when needed.

import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// React Testing Library doesn't auto-cleanup in Vitest like it does in
// Jest. Forgetting this leaks DOM nodes between tests and breaks the
// next assertion that queries by role.
afterEach(() => {
  cleanup();
});
