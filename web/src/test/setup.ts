import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, vi } from 'vitest';
import '@/i18n';
import { server } from './server';

// jsdom lacks these browser APIs used by Mantine and the chat.
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  }),
});
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
window.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
window.HTMLElement.prototype.scrollIntoView = function scrollIntoView() {};
let objectUrls = 0;
URL.createObjectURL = vi.fn(() => `blob:nexora-test/${++objectUrls}`);
URL.revokeObjectURL = vi.fn();

// The console calls the BFF with same-origin relative URLs; Node's fetch needs absolute ones.
const nativeFetch = globalThis.fetch;
globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) =>
  nativeFetch(typeof input === 'string' && input.startsWith('/') ? new URL(input, window.location.origin) : input, init)) as typeof fetch;

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
  document.cookie = 'XSRF-TOKEN=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
  try {
    window.localStorage.clear();
  } catch {
    /* not available */
  }
});
afterAll(() => server.close());
