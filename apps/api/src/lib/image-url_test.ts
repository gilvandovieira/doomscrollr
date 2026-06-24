import {
  checkImageIsFetchable,
  type ImageFetchOptions,
  validateExternalImageUrl,
} from "./image-url.ts";

const PUBLIC_IP = "93.184.216.34";

type DnsRecords = Partial<Record<"A" | "AAAA", string[]>>;

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function assertRejected(result: { ok: true } | { ok: false; reason: string }, reason: string) {
  if (result.ok) throw new Error(`Expected rejection ${reason}.`);
  if (result.reason !== reason) {
    throw new Error(`Expected rejection ${reason}, got ${result.reason}.`);
  }
}

function resolveDns(records: DnsRecords): NonNullable<ImageFetchOptions["resolveDns"]> {
  return (_hostname, recordType) => {
    const values = records[recordType];
    return values ? Promise.resolve(values) : Promise.reject(new Error("no records"));
  };
}

function unexpectedFetch(): typeof fetch {
  return (() => {
    throw new Error("fetch should not run for rejected DNS");
  }) as typeof fetch;
}

Deno.test("image fetch validation accepts a public supported image", async () => {
  const methods: string[] = [];
  const result = await checkImageIsFetchable("https://public.example/image.png", {
    fetcher: (_input, init) => {
      methods.push(init?.method ?? "");
      if (init?.redirect !== "manual") throw new Error("fetch must use manual redirects");
      if ((init?.headers as Record<string, string>).range !== "bytes=0-65535") {
        throw new Error("fetch must use a bounded range probe");
      }
      if (init?.method === "HEAD") {
        return Promise.resolve(
          new Response(null, {
            status: 200,
            headers: { "content-type": "image/png", "content-length": "4" },
          }),
        );
      }
      return Promise.resolve(
        new Response(new Uint8Array([1, 2, 3, 4]), {
          status: 200,
          headers: { "content-type": "image/png", "content-length": "4" },
        }),
      );
    },
    resolveDns: resolveDns({ A: [PUBLIC_IP] }),
  });

  assert(result.ok, "public image should be accepted");
  assert(methods.join(",") === "HEAD,GET", `Unexpected fetch methods: ${methods.join(",")}`);
});

Deno.test("image URL validation rejects private and encoded host literals", () => {
  const checks = [
    "http://localhost/image.png",
    "http://localhost./image.png",
    "http://127.0.0.1/image.png",
    "http://2130706433/image.png",
    "http://0x7f000001/image.png",
    "http://10.0.0.5/image.png",
    "http://169.254.169.254/latest/meta-data",
    "http://[::1]/image.png",
    "http://[fd00::1]/image.png",
    "http://[::ffff:169.254.169.254]/image.png",
    "file:///tmp/image.png",
  ];

  for (const url of checks) {
    const result = validateExternalImageUrl(url);
    if (result.ok) throw new Error(`Expected ${url} to be rejected.`);
  }
});

Deno.test("image fetch validation blocks redirect from public host to private IP", async () => {
  const result = await checkImageIsFetchable("https://public.example/image.png", {
    fetcher: () =>
      Promise.resolve(
        new Response(null, {
          status: 302,
          headers: { location: "http://127.0.0.1/private.png" },
        }),
      ),
    resolveDns: resolveDns({ A: [PUBLIC_IP] }),
  });

  assertRejected(result, "private_host");
});

Deno.test("image fetch validation blocks private DNS answers", async () => {
  const cases: Array<{ name: string; records: DnsRecords }> = [
    { name: "private A", records: { A: [PUBLIC_IP, "10.0.0.8"] } },
    { name: "loopback A", records: { A: ["127.0.0.1"] } },
    { name: "metadata A", records: { A: ["169.254.169.254"] } },
    { name: "link-local AAAA", records: { AAAA: ["fe80::1"] } },
    { name: "unique-local AAAA", records: { AAAA: ["fd00::1"] } },
    { name: "expanded IPv4-mapped AAAA", records: { AAAA: ["0:0:0:0:0:ffff:a9fe:a9fe"] } },
  ];

  for (const { name, records } of cases) {
    const result = await checkImageIsFetchable(`https://${name.replaceAll(" ", "-")}.example/x`, {
      fetcher: unexpectedFetch(),
      resolveDns: resolveDns(records),
    });
    assertRejected(result, "private_host");
  }
});

Deno.test("image URL validation rejects SVG paths", () => {
  assertRejected(
    validateExternalImageUrl("https://public.example/image.svg?cache=1"),
    "svg_not_allowed",
  );
});

Deno.test("image fetch validation rejects SVG content types", async () => {
  const result = await checkImageIsFetchable("https://public.example/image", {
    fetcher: () =>
      Promise.resolve(
        new Response(null, {
          status: 200,
          headers: { "content-type": "image/svg+xml" },
        }),
      ),
    resolveDns: resolveDns({ A: [PUBLIC_IP] }),
  });

  assertRejected(result, "svg_not_allowed");
});

Deno.test("image fetch validation rejects unsupported content types", async () => {
  const result = await checkImageIsFetchable("https://public.example/image", {
    fetcher: () =>
      Promise.resolve(
        new Response(null, {
          status: 200,
          headers: { "content-type": "text/html" },
        }),
      ),
    resolveDns: resolveDns({ A: [PUBLIC_IP] }),
  });

  assertRejected(result, "unsupported_content_type");
});

Deno.test("image fetch validation blocks excessive content-length", async () => {
  const result = await checkImageIsFetchable("https://large.example/image.png", {
    fetcher: () =>
      Promise.resolve(
        new Response(null, {
          status: 200,
          headers: {
            "content-type": "image/png",
            "content-length": String(6 * 1024 * 1024),
          },
        }),
      ),
    resolveDns: resolveDns({ A: [PUBLIC_IP] }),
  });

  assertRejected(result, "image_too_large");
});

Deno.test("image fetch validation caps actual body bytes instead of trusting Range", async () => {
  let calls = 0;
  const result = await checkImageIsFetchable("https://large-body.example/image.png", {
    maxBytes: 8,
    fetcher: () => {
      calls += 1;
      if (calls === 1) {
        return Promise.resolve(
          new Response(null, {
            status: 200,
            headers: { "content-type": "image/png" },
          }),
        );
      }
      return Promise.resolve(
        new Response(new Uint8Array(9), {
          status: 200,
          headers: { "content-type": "image/png" },
        }),
      );
    },
    resolveDns: resolveDns({ A: [PUBLIC_IP] }),
  });

  assertRejected(result, "image_too_large");
});
