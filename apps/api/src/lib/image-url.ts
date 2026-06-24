// External image validation for create + Open Graph fallback (spec §11.3, §12.2).

export const ALLOWED_IMAGE_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
];

export type ImageUrlCheck = { ok: true } | { ok: false; reason: string };

type DnsRecordType = "A" | "AAAA";
type ResolveDns = (hostname: string, recordType: DnsRecordType) => Promise<string[]>;
type Fetcher = typeof fetch;

export type ImageFetchOptions = {
  timeoutMs?: number;
  maxBytes?: number;
  maxRedirects?: number;
  fetcher?: Fetcher;
  resolveDns?: ResolveDns;
};

type ParsedImageUrl = { ok: true; url: URL } | { ok: false; reason: string };

const E2E_IMAGE_URL = "https://e2e.invalid/doomscrollr.png";
const DEFAULT_TIMEOUT_MS = 3000;
const DEFAULT_MAX_BYTES = 5 * 1024 * 1024;
const DEFAULT_MAX_REDIRECTS = 3;
const PROBE_BYTES = 64 * 1024;

function isE2eImageUrl(rawUrl: string): boolean {
  return Deno.env.get("APP_ENV") === "test" &&
    Deno.env.get("E2E_AUTH") === "1" &&
    rawUrl === E2E_IMAGE_URL;
}

function parseImageUrl(rawUrl: string): ParsedImageUrl {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { ok: false, reason: "invalid_url" };
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, reason: "unsupported_protocol" };
  }
  if (!url.hostname || url.username || url.password) {
    return { ok: false, reason: "invalid_url" };
  }
  if (/\.svg($|\?)/i.test(url.pathname + url.search)) {
    return { ok: false, reason: "svg_not_allowed" };
  }
  if (isForbiddenHostLiteral(url.hostname)) {
    return { ok: false, reason: "private_host" };
  }

  return { ok: true, url };
}

// Synchronous structural validation: protocol, host literal, credentials, and
// obvious SVG rejection. DNS-backed validation happens in checkImageIsFetchable.
export function validateExternalImageUrl(rawUrl: string): ImageUrlCheck {
  if (isE2eImageUrl(rawUrl)) return { ok: true };
  const parsed = parseImageUrl(rawUrl);
  return parsed.ok ? { ok: true } : parsed;
}

// Network check that the URL actually serves an allowed image type. Used when
// creating external-image posts. It manually validates every redirect target,
// resolves DNS before each fetch, and reads only a bounded response body.
export async function checkImageIsFetchable(
  rawUrl: string,
  options: ImageFetchOptions | number = {},
): Promise<ImageUrlCheck> {
  if (isE2eImageUrl(rawUrl)) return { ok: true };

  const resolvedOptions = typeof options === "number" ? { timeoutMs: options } : options;
  const timeoutMs = resolvedOptions.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxBytes = resolvedOptions.maxBytes ?? DEFAULT_MAX_BYTES;
  const maxRedirects = resolvedOptions.maxRedirects ?? DEFAULT_MAX_REDIRECTS;
  const fetcher = resolvedOptions.fetcher ?? fetch;
  const resolveDns = resolvedOptions.resolveDns ?? defaultResolveDns;

  const parsed = parseImageUrl(rawUrl);
  if (!parsed.ok) return parsed;

  const signal = AbortSignal.timeout(timeoutMs);

  try {
    const head = await fetchWithValidatedRedirects(parsed.url, {
      method: "HEAD",
      signal,
      maxRedirects,
      fetcher,
      resolveDns,
    });
    if (!head.ok) return head;

    const headResponse = head.response;
    headResponse.body?.cancel().catch(() => undefined);
    if (!isSuccessStatus(headResponse.status)) {
      if (headResponse.status !== 405 && headResponse.status !== 501) {
        return { ok: false, reason: `status_${headResponse.status}` };
      }
    } else {
      const headCheck = checkImageHeaders(headResponse, maxBytes, false);
      if (!headCheck.ok) return headCheck;
    }

    const get = await fetchWithValidatedRedirects(new URL(head.url), {
      method: "GET",
      signal,
      maxRedirects,
      fetcher,
      resolveDns,
    });
    if (!get.ok) return get;

    const response = get.response;
    if (!isSuccessStatus(response.status) && response.status !== 206) {
      return { ok: false, reason: `status_${response.status}` };
    }

    const headerCheck = checkImageHeaders(response, maxBytes, true);
    if (!headerCheck.ok) return headerCheck;

    const bodyCheck = await readBoundedBody(response, maxBytes);
    if (!bodyCheck.ok) return bodyCheck;

    return { ok: true };
  } catch {
    return { ok: false, reason: "unreachable" };
  }
}

async function fetchWithValidatedRedirects(
  initialUrl: URL,
  options: {
    method: "HEAD" | "GET";
    signal: AbortSignal;
    maxRedirects: number;
    fetcher: Fetcher;
    resolveDns: ResolveDns;
  },
): Promise<
  | { ok: true; response: Response; url: string }
  | { ok: false; reason: string }
> {
  let current = initialUrl;

  for (let redirect = 0; redirect <= options.maxRedirects; redirect += 1) {
    const publicHost = await validateResolvedPublicHost(current, options.resolveDns);
    if (!publicHost.ok) return publicHost;

    const response = await options.fetcher(current, {
      method: options.method,
      headers: {
        accept: "image/*",
        range: `bytes=0-${PROBE_BYTES - 1}`,
        "user-agent": "DoomscrollrBot/1.0",
      },
      redirect: "manual",
      signal: options.signal,
    });

    if (!isRedirectStatus(response.status)) {
      return { ok: true, response, url: current.toString() };
    }

    response.body?.cancel().catch(() => undefined);
    if (redirect === options.maxRedirects) return { ok: false, reason: "too_many_redirects" };

    const location = response.headers.get("location");
    if (!location) return { ok: false, reason: "redirect_without_location" };

    try {
      current = new URL(location, current);
    } catch {
      return { ok: false, reason: "invalid_redirect" };
    }

    const structural = parseImageUrl(current.toString());
    if (!structural.ok) return structural;
  }

  return { ok: false, reason: "too_many_redirects" };
}

function checkImageHeaders(
  response: Response,
  maxBytes: number,
  requireContentType: boolean,
): ImageUrlCheck {
  const contentLength = response.headers.get("content-length");
  if (contentLength) {
    const parsed = Number(contentLength);
    if (Number.isFinite(parsed) && parsed > maxBytes) {
      return { ok: false, reason: "image_too_large" };
    }
  }

  const contentType = (response.headers.get("content-type") ?? "").split(";")[0].trim()
    .toLowerCase();
  if (!contentType) {
    return requireContentType ? { ok: false, reason: "missing_content_type" } : { ok: true };
  }
  if (contentType === "image/svg+xml") return { ok: false, reason: "svg_not_allowed" };
  if (!ALLOWED_IMAGE_CONTENT_TYPES.includes(contentType)) {
    return { ok: false, reason: "unsupported_content_type" };
  }
  return { ok: true };
}

async function readBoundedBody(response: Response, maxBytes: number): Promise<ImageUrlCheck> {
  const reader = response.body?.getReader();
  if (!reader) return { ok: false, reason: "empty_body" };

  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) return { ok: false, reason: "image_too_large" };
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }

  return total > 0 ? { ok: true } : { ok: false, reason: "empty_body" };
}

async function validateResolvedPublicHost(
  url: URL,
  resolveDns: ResolveDns,
): Promise<ImageUrlCheck> {
  const hostname = normalizeHostLiteral(url.hostname);
  if (isIpLiteral(hostname)) {
    return isForbiddenIpLiteral(hostname) ? { ok: false, reason: "private_host" } : { ok: true };
  }

  const results = await Promise.allSettled([
    resolveDns(hostname, "A"),
    resolveDns(hostname, "AAAA"),
  ]);
  const addresses = results
    .flatMap((result) => result.status === "fulfilled" ? result.value : [])
    .filter(Boolean);

  if (addresses.length === 0) return { ok: false, reason: "dns_lookup_failed" };
  if (addresses.some((address) => isForbiddenIpLiteral(address))) {
    return { ok: false, reason: "private_host" };
  }

  return { ok: true };
}

function defaultResolveDns(hostname: string, recordType: DnsRecordType): Promise<string[]> {
  return Deno.resolveDns(hostname, recordType);
}

function isSuccessStatus(status: number): boolean {
  return status >= 200 && status < 300;
}

function isRedirectStatus(status: number): boolean {
  return status === 301 || status === 302 || status === 303 || status === 307 || status === 308;
}

function isForbiddenHostLiteral(hostname: string): boolean {
  const host = normalizeHostLiteral(hostname);
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) return true;
  return isForbiddenIpLiteral(host);
}

function isForbiddenIpLiteral(value: string): boolean {
  const host = normalizeHostLiteral(value);
  const ipv4 = parseIpv4(host);
  if (ipv4) return isForbiddenIpv4(ipv4);
  if (host.includes(":")) return isForbiddenIpv6(host);
  return false;
}

function isIpLiteral(value: string): boolean {
  const host = normalizeHostLiteral(value);
  return parseIpv4(host) !== null || host.includes(":");
}

function normalizeHostLiteral(value: string): string {
  const host = value.trim().toLowerCase().replace(/^\[/, "").replace(/\]$/, "");
  return host.endsWith(".") ? host.slice(0, -1) : host;
}

function parseIpv4(value: string): [number, number, number, number] | null {
  const parts = value.split(".");
  if (parts.length !== 4) return null;
  const octets = parts.map((part) => {
    if (!/^\d{1,3}$/.test(part)) return Number.NaN;
    return Number(part);
  });
  if (octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) {
    return null;
  }
  return octets as [number, number, number, number];
}

function isForbiddenIpv4([a, b, c]: [number, number, number, number]): boolean {
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 0 && (c === 0 || c === 2)) return true;
  if (a === 192 && b === 168) return true;
  if (a === 192 && b === 88 && c === 99) return true;
  if (a === 198 && (b === 18 || b === 19)) return true;
  if (a === 198 && b === 51 && c === 100) return true;
  if (a === 203 && b === 0 && c === 113) return true;
  if (a >= 224) return true;
  return false;
}

function isForbiddenIpv6(value: string): boolean {
  const host = value.toLowerCase();
  if (host === "::" || host === "::1") return true;
  if (host.startsWith("::ffff:")) return true;
  if (/^(?:0{1,4}:){5}f{4}:/i.test(host)) return true;
  if (host.startsWith("64:ff9b:") || host === "64:ff9b::") return true;
  if (host.startsWith("100:")) return true;
  if (host.startsWith("2001:db8:") || host === "2001:db8::") return true;
  if (host.startsWith("2001:0:") || host === "2001::") return true;
  if (host.startsWith("2001:2:")) return true;
  if (host.startsWith("2001:10:")) return true;
  if (host.startsWith("2002:")) return true;

  const first = Number.parseInt(host.split(":", 1)[0] || "0", 16);
  if (!Number.isFinite(first)) return true;
  if ((first & 0xfe00) === 0xfc00) return true; // fc00::/7 unique local.
  if ((first & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local.
  if ((first & 0xff00) === 0xff00) return true; // ff00::/8 multicast.

  return false;
}
