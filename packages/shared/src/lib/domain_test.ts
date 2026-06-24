import { domainMatchesBlock, hostnameFromUrl, normalizeDomain } from "./domain.ts";

Deno.test("normalizeDomain accepts domains and URL hostnames only", () => {
  const normalized = normalizeDomain("HTTPS://WWW.YouTube.com/watch?v=abc");
  if (normalized !== "www.youtube.com") {
    throw new Error(`Expected URL hostname normalization, received ${normalized}`);
  }

  if (normalizeDomain("*.youtube.com") !== null) {
    throw new Error("Wildcard domains must not be accepted.");
  }
  if (normalizeDomain("youtube.com/watch") !== null) {
    throw new Error("Path-only domain input must not be accepted.");
  }
});

Deno.test("domainMatchesBlock matches exact domains and subdomains", () => {
  if (!domainMatchesBlock("youtube.com", "youtube.com")) {
    throw new Error("Expected exact domain match.");
  }
  if (!domainMatchesBlock("www.youtube.com", "youtube.com")) {
    throw new Error("Expected subdomain match.");
  }
  if (domainMatchesBlock("notyoutube.com", "youtube.com")) {
    throw new Error("Suffix-only lookalikes must not match.");
  }
});

Deno.test("hostnameFromUrl extracts normalized hostnames", () => {
  const hostname = hostnameFromUrl("https://m.youtube.com/shorts/abc");
  if (hostname !== "m.youtube.com") {
    throw new Error(`Expected m.youtube.com, received ${hostname}`);
  }
});
