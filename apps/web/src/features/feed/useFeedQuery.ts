import { useInfiniteQuery } from "@tanstack/react-query";
import { useAuthToken, useIsSignedIn } from "../../app/account.ts";
import { fetchRecentFeed, fetchTagFeed } from "../../app/api.ts";

// Recent feed only, keyset pagination (spec §9). Keyed by sign-in state so the
// personalized view (the viewer's own reactions, block filtering) caches apart
// from the logged-out view.
export function useRecentFeed() {
  const getToken = useAuthToken();
  const signedIn = useIsSignedIn();
  return useInfiniteQuery({
    queryKey: ["feed", "recent", signedIn],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => fetchRecentFeed({ cursor: pageParam, limit: 20 }, getToken),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
}

export function useTagFeed(tagSlug: string) {
  const getToken = useAuthToken();
  const signedIn = useIsSignedIn();
  return useInfiniteQuery({
    queryKey: ["feed", "tag", tagSlug, signedIn],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => fetchTagFeed(tagSlug, { cursor: pageParam, limit: 20 }, getToken),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: tagSlug.length > 0,
  });
}
