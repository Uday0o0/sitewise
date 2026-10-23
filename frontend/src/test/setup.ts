import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// Ensure window.fetch delegates to globalThis.fetch in JSDOM
if (typeof window !== 'undefined') {
  // Bind fetch so spies on global.fetch or window.fetch always intercept calls
  window.fetch = (...args: any[]) => (globalThis.fetch as any)(...args);
}

// Automatically cleanup DOM after each test
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
