const DOMAIN_LABEL_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

export function normalizeDomain(input: string): string | null {
  const raw = input.trim().toLowerCase();
  if (!raw) return null;

  let host = raw;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) {
    try {
      host = new URL(raw).hostname;
    } catch {
      return null;
    }
  }

  host = host.trim().replace(/\.$/, "");
  if (!host || host.length > 253 || host.includes("/") || host.includes(":")) return null;

  const labels = host.split(".");
  if (labels.length < 2) return null;
  if (!labels.every((label) => DOMAIN_LABEL_PATTERN.test(label))) return null;

  return labels.join(".");
}

export function hostnameFromUrl(input: string): string | null {
  try {
    return normalizeDomain(new URL(input).hostname);
  } catch {
    return null;
  }
}

export function domainMatchesBlock(hostname: string, blockedDomain: string): boolean {
  const host = normalizeDomain(hostname);
  const blocked = normalizeDomain(blockedDomain);
  if (!host || !blocked) return false;
  return host === blocked || host.endsWith(`.${blocked}`);
}
