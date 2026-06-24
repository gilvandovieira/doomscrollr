import { getMockFeed, getSortedMockPosts } from "./mock-data.ts";

Deno.test("mock feed returns 9 items and a cursor for the next batch", () => {
  const firstPage = getMockFeed({ sort: "hot", limit: 9 });
  const secondPage = getMockFeed({
    sort: "hot",
    limit: 9,
    cursor: firstPage.nextCursor ?? undefined,
  });

  if (firstPage.items.length !== 9) {
    throw new Error(`Expected 9 first-page items, received ${firstPage.items.length}.`);
  }

  if (!firstPage.nextCursor) {
    throw new Error("Expected first page to expose a next cursor.");
  }

  const firstPageIds = new Set(firstPage.items.map((post) => post.id));
  const overlap = secondPage.items.some((post) => firstPageIds.has(post.id));

  if (overlap) {
    throw new Error("Cursor pagination returned duplicate posts across pages.");
  }
});

Deno.test("recent mock sort orders posts by created date descending", () => {
  const recentPosts = getSortedMockPosts("recent");

  for (let index = 1; index < recentPosts.length; index += 1) {
    const previous = Date.parse(recentPosts[index - 1].createdAt);
    const current = Date.parse(recentPosts[index].createdAt);

    if (previous < current) {
      throw new Error("Recent sort returned an older post before a newer post.");
    }
  }
});
