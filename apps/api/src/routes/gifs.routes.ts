import { mockGifs } from "@doomscrollr/shared/mock-data.ts";
import { Hono } from "hono";

export const gifsRoutes = new Hono();

gifsRoutes.get("/trending", (c) => c.json({ items: mockGifs }));

gifsRoutes.get("/search", (c) => {
  const query = c.req.query("q")?.trim().toLowerCase() ?? "";
  const items = query.length === 0
    ? mockGifs
    : mockGifs.filter((gif) =>
      `${gif.providerMediaId} ${gif.attributionLabel}`.toLowerCase().includes(query)
    );

  return c.json({ items });
});
