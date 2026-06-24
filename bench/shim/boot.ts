// Install the Deno shim, then boot the real API entrypoint unchanged.
import "./deno-shim.ts";
await import("./apps/api/src/main.ts");
