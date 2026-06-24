export const CLERK_PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
export const HAS_CLERK = Boolean(CLERK_PUBLISHABLE_KEY);
export const HAS_TEST_AUTH = import.meta.env.DEV && import.meta.env.VITE_E2E_AUTH === "1";
export const TEST_AUTH_STORAGE_KEY = "doomscrollr.e2eClerkId";

export type GetAuthToken = () => Promise<string | null>;

export function readTestAuthClerkId(): string | null {
  if (!HAS_TEST_AUTH || typeof globalThis.localStorage === "undefined") return null;
  const value = globalThis.localStorage.getItem(TEST_AUTH_STORAGE_KEY)?.trim();
  return value || null;
}
