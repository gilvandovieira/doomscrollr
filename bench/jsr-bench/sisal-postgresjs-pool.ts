// PROTOTYPE: a postgres.js-backed PgPool for @sisal/pg — kept in doomscrollr (NOT the
// sisal repo). It targets the PUBLISHED jsr:@sisal/pg@0.5.0 through its public
// PgPool/PgClient interface, injected via connect({ pool }), so it needs zero changes
// to Sisal itself. Swaps the slow jsr:@db/postgres extended-protocol path for
// postgres.js (TCP_NODELAY + pipelining).
import type { PgClient, PgPool } from "jsr:@sisal/pg@^0.5.0";
// deno-lint-ignore no-import-prefix
import postgres from "npm:postgres@^3.4.7";

/** Options for the postgres.js-backed pool. */
export interface PostgresJsPoolOptions {
  readonly url: string;
  /** Max pooled connections (postgres.js `max`). Default 5. */
  readonly poolSize?: number;
  /** Set false for PgBouncer/Neon-pooled endpoints (no named prepared statements). */
  readonly prepare?: boolean;
}

// The bits of a postgres.js result we read (`columns[].type` is the PG type OID).
interface PgJsColumn {
  readonly name: string;
  readonly type: number;
}
interface PgJsResult extends Array<Record<string, unknown>> {
  readonly count?: number;
  readonly columns?: readonly PgJsColumn[];
}
interface PgJsReserved {
  unsafe(query: string, args: readonly unknown[]): Promise<PgJsResult>;
  release(): void;
}
interface PgJsSql {
  reserve(): Promise<PgJsReserved>;
  end(options?: { readonly timeout?: number }): Promise<void>;
}

/**
 * Creates a {@link PgPool} backed by postgres.js. Each `connect()` reserves one
 * physical connection (`sql.reserve()`) so an interactive transaction's
 * begin/…/commit stay on the same socket — Sisal's executor calls `pool.connect()`
 * once per execute()/transaction() and releases after.
 */
export function createPostgresJsPool(options: PostgresJsPoolOptions): PgPool {
  const sql = postgres(options.url, {
    max: options.poolSize ?? 5,
    prepare: options.prepare ?? true,
  }) as unknown as PgJsSql;

  return {
    async connect(): Promise<PgClient> {
      const reserved = await sql.reserve();

      return {
        async queryObject<Row = Record<string, unknown>>(
          query: string,
          args: unknown[] = [],
        ) {
          const result = await reserved.unsafe(query, args);
          const columns = result.columns;
          return {
            rows: result as unknown as Row[],
            rowCount: result.count ?? result.length,
            rowDescription: columns
              ? { columns: columns.map((c) => ({ name: c.name, typeOid: c.type })) }
              : null,
          };
        },
        release(): void {
          reserved.release();
        },
      } as PgClient;
    },

    async end(): Promise<void> {
      await sql.end({ timeout: 5 });
    },
  };
}
