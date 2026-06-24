// End-to-end test harness for the Doomscrollr API.
//
// What this gives a test:
//   - a *real* Hono server, booted in-process on a random port and driven over
//     real HTTP (not app.request), so the full middleware + route + repository +
//     Postgres path is exercised exactly as in production;
//   - a *dedicated, ephemeral* Postgres database (doomscrollr_test) that is dropped,
//     recreated, migrated, and seeded fresh on the first call, so runs are
//     deterministic and the dev database is never touched;
//   - deterministic, offline auth via the gated `test:<clerkUserId>` seam
//     (see apps/api/src/middleware/auth.ts). No Clerk network calls.
//
// Lifecycle: setup runs once, lazily, on the first `getHarness()` (i.e. the first
// `api()` call). Tests share the one server + database. The Deno test runner exits
// the process when the suite finishes, which tears everything down; we therefore
// disable the per-test resource/op sanitizers (see `e2eTest`) for the long-lived
// server and connection pool that intentionally outlive individual tests.

import postgres from "postgres";

const DEFAULT_BASE_DATABASE_URL = "postgres://doomscrollr:doomscrollr@localhost:5433/doomscrollr";
const TEST_DB_NAME = "doomscrollr_test";

// Resolve the maintenance connection (an existing database we can issue
// CREATE/DROP DATABASE against). Defaults to the local compose Postgres; override
// with E2E_BASE_DATABASE_URL to point at another server.
function baseDatabaseUrl(): string {
  return Deno.env.get("E2E_BASE_DATABASE_URL") ?? DEFAULT_BASE_DATABASE_URL;
}

function deriveTestDatabaseUrl(base: string): string {
  const url = new URL(base);
  url.pathname = `/${TEST_DB_NAME}`;
  return url.toString();
}

const MIGRATE_SCRIPT = new URL("../../../packages/database/src/migrate.ts", import.meta.url);
const SEED_SCRIPT = new URL("../../../packages/database/src/seed.ts", import.meta.url);

// --- Seeded fixtures (mirror packages/shared/src/mock-data.ts) ---------------

export const USERS = {
  // lucas is the only seeded admin; the rest are active regular users.
  admin: { clerkId: "clerk_mock_lucas", username: "lucas" },
  maya: { clerkId: "clerk_mock_maya", username: "maya" },
  ren: { clerkId: "clerk_mock_ren", username: "ren" },
  ana: { clerkId: "clerk_mock_ana", username: "ana" },
} as const;

// A Clerk id with no local user row yet — exercises the username onboarding gate.
export const UNSEEDED_CLERK_ID = "clerk_e2e_newcomer";

export const POSTS = {
  fridayText: { code: "7kF3mQx9Za", slug: "when-prod-breaks-on-friday", author: "lucas" },
  forumsText: {
    code: "Qd8RtVn2Lp",
    slug: "why-old-forums-felt-better-than-discord",
    author: "maya",
  },
  cacheImage: { code: "Mw4Yb6Hc3K", slug: "the-cache-invalidated-itself", author: "ren" },
  shortYoutube: { code: "Zp9Lk2Dn5T", slug: "this-short-is-too-accurate", author: "ana" },
  classicYoutube: {
    code: "Bf2Hn7Wq4R",
    slug: "the-video-that-started-the-internet",
    author: "maya",
  },
} as const;

export const COMMENTS = {
  topLevel: "c4Kd9Lm2Pq", // by maya, on fridayText
  reply: "c7Rn3Tb8Wx", // by lucas, reply to topLevel
} as const;

export const TAGS = ["programming", "internet", "memes", "music"] as const;

// --- Harness setup -----------------------------------------------------------

type Harness = { baseUrl: string };

let harnessPromise: Promise<Harness> | null = null;

export function getHarness(): Promise<Harness> {
  if (!harnessPromise) harnessPromise = startHarness();
  return harnessPromise;
}

async function startHarness(): Promise<Harness> {
  const base = baseDatabaseUrl();
  const testUrl = deriveTestDatabaseUrl(base);

  await recreateTestDatabase(base);
  await runScript(MIGRATE_SCRIPT, testUrl);
  await runScript(SEED_SCRIPT, testUrl);

  // These must be set BEFORE importing app.ts: the db client, logger, and several
  // route modules read env at import time.
  Deno.env.set("APP_ENV", "test");
  Deno.env.set("E2E_AUTH", "1");
  Deno.env.set("DATABASE_URL", testUrl);
  Deno.env.set("PUBLIC_BASE_URL", "http://localhost:8000");
  Deno.env.set("WEB_ORIGIN", "http://localhost:5173");
  Deno.env.set("LOG_LEVEL", "fatal");
  // Guarantee the real Clerk path is never reachable from a test run.
  Deno.env.delete("CLERK_SECRET_KEY");

  const { app } = await import("../src/app.ts");
  const server = Deno.serve({ port: 0, onListen: () => {} }, app.fetch);
  const { port } = server.addr as Deno.NetAddr;

  return { baseUrl: `http://localhost:${port}` };
}

async function recreateTestDatabase(maintenanceUrl: string): Promise<void> {
  const admin = postgres(maintenanceUrl, { max: 1 });
  try {
    // FORCE (Postgres 13+) terminates any lingering connections from a prior run.
    await admin.unsafe(`DROP DATABASE IF EXISTS ${TEST_DB_NAME} WITH (FORCE)`);
    await admin.unsafe(`CREATE DATABASE ${TEST_DB_NAME}`);
  } finally {
    await admin.end();
  }
}

// Run migrate.ts / seed.ts as the repo does, but against the ephemeral test DB.
// Reusing the real scripts keeps the schema and seed identical to dev.
async function runScript(scriptUrl: URL, databaseUrl: string): Promise<void> {
  const command = new Deno.Command("deno", {
    args: ["run", "--allow-env", "--allow-net", "--allow-read", scriptUrl.href],
    env: { DATABASE_URL: databaseUrl },
    stdout: "piped",
    stderr: "piped",
  });
  const { code, stderr } = await command.output();
  if (code !== 0) {
    throw new Error(
      `e2e setup: ${scriptUrl.pathname.split("/").pop()} failed (exit ${code}).\n` +
        new TextDecoder().decode(stderr),
    );
  }
}

// --- HTTP client -------------------------------------------------------------

export type ApiResponse<T = unknown> = {
  status: number;
  ok: boolean;
  json: T;
  text: string;
  headers: Headers;
};

export type ApiInit = {
  method?: "GET" | "POST" | "DELETE";
  body?: unknown;
  // Clerk user id to impersonate via the gated test-auth seam.
  asUser?: string;
  headers?: Record<string, string>;
};

export async function api<T = unknown>(path: string, init: ApiInit = {}): Promise<ApiResponse<T>> {
  const { baseUrl } = await getHarness();
  const headers = new Headers(init.headers);

  let body: string | undefined;
  if (init.body !== undefined) {
    headers.set("content-type", "application/json");
    body = JSON.stringify(init.body);
  }
  if (init.asUser) {
    headers.set("authorization", `Bearer test:${init.asUser}`);
  }

  const response = await fetch(`${baseUrl}${path}`, {
    method: init.method ?? (init.body !== undefined ? "POST" : "GET"),
    headers,
    body,
  });

  const text = await response.text();
  const isJson = response.headers.get("content-type")?.includes("application/json") ?? false;
  const json = (isJson && text ? JSON.parse(text) : null) as T;

  return { status: response.status, ok: response.ok, json, text, headers: response.headers };
}

// --- Test wrapper + assertions (dependency-free, matching repo convention) ---

// Integration tests share a long-lived server and connection pool, so the
// per-test resource/op sanitizers are disabled here by design.
export function e2eTest(name: string, fn: () => void | Promise<void>): void {
  Deno.test({ name, sanitizeResources: false, sanitizeOps: false }, fn);
}

export function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

export function assertEquals<T>(actual: T, expected: T, context?: string): void {
  if (!Object.is(actual, expected)) {
    const where = context ? `${context}: ` : "";
    throw new Error(
      `${where}expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`,
    );
  }
}

export function assertStatus(response: ApiResponse, expected: number): void {
  if (response.status !== expected) {
    throw new Error(
      `expected HTTP ${expected}, received ${response.status}. Body: ${
        response.text.slice(0, 500)
      }`,
    );
  }
}

export function assertIncludes(haystack: string, needle: string, context?: string): void {
  if (!haystack.includes(needle)) {
    const where = context ? `${context}: ` : "";
    throw new Error(
      `${where}expected to find ${JSON.stringify(needle)} in:\n${haystack.slice(0, 800)}`,
    );
  }
}
