// External image validation for create + Open Graph fallback (spec §11.3, §12.2).

export const ALLOWED_IMAGE_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
];

export type ImageUrlCheck = { ok: true } | { ok: false; reason: string };

const E2E_IMAGE_URL = "https://e2e.invalid/doomscrollr.png";

function isE2eImageUrl(rawUrl: string): boolean {
  return Deno.env.get("APP_ENV") === "test" &&
    Deno.env.get("E2E_AUTH") === "1" &&
    rawUrl === E2E_IMAGE_URL;
}

function isPrivateHostname(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost")) return true;
  if (host === "0.0.0.0" || host === "::1" || host === "[::1]") return true;

  // IPv4 private / loopback / link-local ranges.
  if (/^127\./.test(host)) return true;
  if (/^10\./.test(host)) return true;
  if (/^192\.168\./.test(host)) return true;
  if (/^169\.254\./.test(host)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(host)) return true;

  // IPv6 loopback / unique-local / link-local.
  if (/^f[cd][0-9a-f]{2}:/i.test(host) || /^fe80:/i.test(host)) return true;

  return false;
}

// Synchronous structural validation: protocol, host, and obvious SVG rejection.
export function validateExternalImageUrl(rawUrl: string): ImageUrlCheck {
  if (isE2eImageUrl(rawUrl)) return { ok: true };

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { ok: false, reason: "invalid_url" };
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, reason: "unsupported_protocol" };
  }
  if (isPrivateHostname(url.hostname)) {
    return { ok: false, reason: "private_host" };
  }
  if (/\.svg($|\?)/i.test(url.pathname + url.search)) {
    return { ok: false, reason: "svg_not_allowed" };
  }

  return { ok: true };
}

// Network check that the URL actually serves an allowed image type. Used when
// creating external-image posts and when deciding whether to trust an og:image.
export async function checkImageIsFetchable(
  rawUrl: string,
  timeoutMs = 2500,
): Promise<ImageUrlCheck> {
  if (isE2eImageUrl(rawUrl)) return { ok: true };

  const structural = validateExternalImageUrl(rawUrl);
  if (!structural.ok) return structural;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(rawUrl, {
      method: "GET",
      headers: { range: "bytes=0-0", "user-agent": "DoomscrollrBot/1.0" },
      redirect: "follow",
      signal: controller.signal,
    });
    if (!response.ok && response.status !== 206) {
      return { ok: false, reason: `status_${response.status}` };
    }
    const contentType = (response.headers.get("content-type") ?? "").split(";")[0].trim()
      .toLowerCase();
    // Drain the tiny body so the connection can be reused/closed.
    await response.arrayBuffer().catch(() => undefined);

    if (contentType === "image/svg+xml") return { ok: false, reason: "svg_not_allowed" };
    if (!ALLOWED_IMAGE_CONTENT_TYPES.includes(contentType)) {
      return { ok: false, reason: "unsupported_content_type" };
    }
    return { ok: true };
  } catch {
    return { ok: false, reason: "unreachable" };
  } finally {
    clearTimeout(timer);
  }
}
