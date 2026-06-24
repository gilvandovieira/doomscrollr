import { mockGifs } from "@doomscrollr/shared/mock-data.ts";

export function searchMockGifs(query: string) {
  const normalized = query.trim().toLowerCase();

  if (!normalized) {
    return mockGifs;
  }

  return mockGifs.filter((gif) =>
    `${gif.providerMediaId} ${gif.attributionLabel}`.toLowerCase().includes(normalized)
  );
}
