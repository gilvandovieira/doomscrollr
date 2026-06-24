import { useInfiniteQuery } from "@tanstack/react-query";
import { fetchRecentFeed } from "../../app/api.ts";

// Recent feed only, keyset pagination (spec §9).
export function useRecentFeed() {
  return useInfiniteQuery({
    queryKey: ["feed", "recent"],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => fetchRecentFeed({ cursor: pageParam, limit: 20 }),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
}
