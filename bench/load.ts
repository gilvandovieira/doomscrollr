// Tiny closed-loop load generator. Runs on Bun.
// usage: bun load.ts <url> <concurrency> <durationSeconds>
const url = Bun.argv[2];
const concurrency = Number(Bun.argv[3] ?? 50);
const durationMs = Number(Bun.argv[4] ?? 10) * 1000;

const latencies: number[] = [];
let errors = 0;
let status2xx = 0;
const endAt = Date.now() + durationMs;

async function worker() {
  while (Date.now() < endAt) {
    const t = performance.now();
    try {
      const r = await fetch(url);
      await r.arrayBuffer(); // drain body so the server actually serializes/sends
      if (r.status >= 200 && r.status < 400) status2xx++;
      else errors++;
    } catch {
      errors++;
    }
    latencies.push(performance.now() - t);
  }
}

await Promise.all(Array.from({ length: concurrency }, worker));

latencies.sort((a, b) => a - b);
const pct = (p: number) => latencies.length ? latencies[Math.min(latencies.length - 1, Math.floor(latencies.length * p))] : 0;
const total = latencies.length;
const secs = durationMs / 1000;
const round = (n: number) => Math.round(n * 100) / 100;

console.log(JSON.stringify({
  total,
  rps: Math.round(total / secs),
  ok: status2xx,
  errors,
  p50: round(pct(0.5)),
  p90: round(pct(0.9)),
  p99: round(pct(0.99)),
  max: round(latencies.at(-1) ?? 0),
}));
