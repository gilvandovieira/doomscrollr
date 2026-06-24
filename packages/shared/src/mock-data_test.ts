import { getMockFeed } from "./mock-data.ts";

Deno.test("mock recent feed paginates without overlap via keyset cursor", () => {
  const firstPage = getMockFeed({ limit: 2 });

  if (firstPage.items.length !== 2) {
    throw new Error(`Expected 2 first-page items, received ${firstPage.items.length}.`);
  }
  if (!firstPage.nextCursor) {
    throw new Error("Expected first page to expose a next cursor.");
  }

  const secondPage = getMockFeed({ limit: 2, cursor: firstPage.nextCursor });
  const firstCodes = new Set(firstPage.items.map((post) => post.publicCode));
  const overlap = secondPage.items.some((post) => firstCodes.has(post.publicCode));

  if (overlap) {
    throw new Error("Cursor pagination returned duplicate posts across pages.");
  }
});

Deno.test("mock recent feed orders posts newest-first", () => {
  const { items } = getMockFeed({ limit: 50 });

  for (let index = 1; index < items.length; index += 1) {
    if (Date.parse(items[index - 1].createdAt) < Date.parse(items[index].createdAt)) {
      throw new Error("Recent feed returned an older post before a newer post.");
    }
  }
});
