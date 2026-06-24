import type { FeedSort } from "@doomscrollr/shared/types.ts";
import { useInfiniteQuery } from "@tanstack/react-query";
import { fetchFeedPage } from "../../app/api.ts";

export function useFeedQuery(sort: FeedSort) {
  return useInfiniteQuery({
    queryKey: ["feed", sort],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      fetchFeedPage({
        sort,
        cursor: pageParam,
        limit: 9,
      }),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
}
