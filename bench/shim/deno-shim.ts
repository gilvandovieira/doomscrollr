// Minimal `Deno` global so apps/api/src/main.ts runs unmodified on Node and Bun.
// Covers exactly the Deno.* surface the server path uses: env, exit, signals,
// serve, resolveDns. (Deno.test / readDir / readTextFile are only in test + db
// scripts, which we don't boot here.)
import process from "node:process";
import dns from "node:dns/promises";

const isBun = typeof (globalThis as { Bun?: unknown }).Bun !== "undefined";

// @hono/node-server is only needed (and only installed-as-used) on Node.
let nodeServe: ((opts: Record<string, unknown>) => { close: (cb: () => void) => void }) | undefined;
if (!isBun) {
  ({ serve: nodeServe } = await import("@hono/node-server"));
}

type Handler = (req: Request, info?: unknown) => Response | Promise<Response>;

const denoShim = {
  pid: process.pid,
  env: {
    get: (k: string) => process.env[k],
    set: (k: string, v: string) => void (process.env[k] = v),
    has: (k: string) => process.env[k] !== undefined,
    delete: (k: string) => void delete process.env[k],
    toObject: () => ({ ...process.env }),
  },
  exit: (code = 0): never => process.exit(code) as never,
  addSignalListener: (sig: string, handler: () => void) =>
    process.on(sig as NodeJS.Signals, handler),
  removeSignalListener: (sig: string, handler: () => void) =>
    process.off(sig as NodeJS.Signals, handler),
  resolveDns: async (host: string, recordType: string): Promise<string[]> => {
    if (recordType === "AAAA") return await dns.resolve6(host);
    if (recordType === "A") return await dns.resolve4(host);
    throw new Error(`deno-shim: unsupported DNS record type ${recordType}`);
  },
  serve: (opts: { port?: number; hostname?: string } | Handler, maybeHandler?: Handler) => {
    const handler = (typeof opts === "function" ? opts : maybeHandler) as Handler;
    const options = (typeof opts === "object" ? opts : {}) as { port?: number; hostname?: string };
    const port = options.port ?? 8000;
    const hostname = options.hostname ?? "0.0.0.0";
    const addr = { hostname, port, transport: "tcp" as const };

    if (isBun) {
      const server = (globalThis as { Bun: { serve: (o: unknown) => { stop: (b?: boolean) => void } } })
        .Bun.serve({ port, hostname, fetch: handler });
      return {
        addr,
        finished: new Promise<void>(() => {}),
        shutdown: () => Promise.resolve(server.stop(true)),
        ref() {},
        unref() {},
      };
    }

    const server = nodeServe!({ fetch: handler, port, hostname });
    return {
      addr,
      finished: new Promise<void>(() => {}),
      shutdown: () => new Promise<void>((resolve) => server.close(() => resolve())),
      ref() {},
      unref() {},
    };
  },
};

(globalThis as { Deno?: unknown }).Deno = denoShim;
