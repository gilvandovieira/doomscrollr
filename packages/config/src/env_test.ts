import { readServerEnv } from "./env.ts";

const PROD_ENV = {
  APP_ENV: "production",
  PORT: "8000",
  DATABASE_URL: "postgres://user:pass@db.example.com:5432/doomscrollr",
  PUBLIC_BASE_URL: "https://api.example.com",
  WEB_ORIGIN: "https://app.example.com",
  CLERK_SECRET_KEY: "sk_live_placeholder",
  CLERK_AUTHORIZED_PARTIES: "https://app.example.com",
};

Deno.test("production env requires database, Clerk, base URL, and web origin", () => {
  const missing = { APP_ENV: "production" };

  assertThrowsMessage(
    () => readServerEnv(missing),
    "DATABASE_URL is required in production.",
  );
  assertThrowsMessage(
    () => readServerEnv(missing),
    "CLERK_SECRET_KEY is required in production.",
  );
  assertThrowsMessage(
    () => readServerEnv(missing),
    "CLERK_AUTHORIZED_PARTIES is required in production",
  );
  assertThrowsMessage(
    () => readServerEnv(missing),
    "PUBLIC_BASE_URL is required in production.",
  );
  assertThrowsMessage(
    () => readServerEnv(missing),
    "WEB_ORIGIN is required in production.",
  );
});

Deno.test("production env rejects localhost origins, debug logging, and mock fallback", () => {
  assertThrowsMessage(
    () =>
      readServerEnv({
        ...PROD_ENV,
        PUBLIC_BASE_URL: "http://localhost:8000",
      }),
    "PUBLIC_BASE_URL must not point to localhost in production.",
  );
  assertThrowsMessage(
    () =>
      readServerEnv({
        ...PROD_ENV,
        WEB_ORIGIN: "http://127.0.0.1:5173",
      }),
    "WEB_ORIGIN must not point to localhost in production.",
  );
  assertThrowsMessage(
    () => readServerEnv({ ...PROD_ENV, LOG_LEVEL: "debug" }),
    "LOG_LEVEL must be info or stricter in production.",
  );
  assertThrowsMessage(
    () => readServerEnv({ ...PROD_ENV, ENABLE_MOCK_FALLBACK: "1" }),
    "ENABLE_MOCK_FALLBACK must not be enabled in production.",
  );
});

Deno.test("production env defaults LOG_LEVEL to info", () => {
  const env = readServerEnv(PROD_ENV);
  if (env.LOG_LEVEL !== "info") {
    throw new Error(`Expected production LOG_LEVEL default info, got ${env.LOG_LEVEL}.`);
  }
});

Deno.test("development env keeps localhost defaults ergonomic", () => {
  const env = readServerEnv({});
  if (env.APP_ENV !== "development") throw new Error("Expected development default.");
  if (env.PUBLIC_BASE_URL !== "http://localhost:8000") {
    throw new Error(`Unexpected dev PUBLIC_BASE_URL: ${env.PUBLIC_BASE_URL}`);
  }
  if (env.WEB_ORIGIN !== "http://localhost:5173") {
    throw new Error(`Unexpected dev WEB_ORIGIN: ${env.WEB_ORIGIN}`);
  }
  if (env.LOG_LEVEL !== "debug") throw new Error("Expected development LOG_LEVEL debug.");
});

function assertThrowsMessage(fn: () => unknown, expected: string): void {
  try {
    fn();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes(expected)) {
      throw new Error(`Expected error containing ${expected}, got ${message}`);
    }
    return;
  }
  throw new Error(`Expected function to throw ${expected}`);
}
