import type { FeedSort } from "@doomscrollr/shared/types.ts";
import { Loader2 } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import { AdSlot } from "../../components/AdSlot.tsx";
import { PostCard } from "./PostCard.tsx";
import { useFeedQuery } from "./useFeedQuery.ts";

type FeedPageProps = {
  sort: FeedSort;
};

const feedCopy = {
  hot: {
    label: "Hot feed",
    title: "The scroll starts loud.",
    description: "Ranked by a simple hot score so new posts can still punch upward.",
  },
  recent: {
    label: "Recent feed",
    title: "Fresh posts, no mysticism.",
    description: "Newest first with cursor pagination shaped like the production endpoint.",
  },
  top: {
    label: "Top feed",
    title: "The scoreboard view.",
    description: "Sorted by score for the posts that already survived the room.",
  },
};

export function FeedPage({ sort }: FeedPageProps) {
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const feedQuery = useFeedQuery(sort);
  const { fetchNextPage, hasNextPage, isFetchingNextPage } = feedQuery;
  const copy = feedCopy[sort];
  const posts = useMemo(
    () => feedQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [feedQuery.data],
  );

  useEffect(() => {
    const sentinel = sentinelRef.current;

    if (!sentinel) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const firstEntry = entries[0];
        if (firstEntry?.isIntersecting && hasNextPage && !isFetchingNextPage) {
          void fetchNextPage();
        }
      },
      { rootMargin: "640px 0px" },
    );

    observer.observe(sentinel);

    return () => observer.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  return (
    <section className="space-y-5">
      <div className="grid gap-3 border-b-2 border-ink pb-4 md:grid-cols-[1fr_auto] md:items-end">
        <div>
          <p className="font-mono text-xs font-black uppercase text-oxide">{copy.label}</p>
          <h1 className="mt-1 max-w-3xl font-display text-5xl uppercase leading-none sm:text-6xl">
            {copy.title}
          </h1>
        </div>
        <p className="max-w-md text-sm font-bold leading-6 text-pitch">{copy.description}</p>
      </div>

      {feedQuery.isLoading ? <FeedLoadingState /> : (
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((post, index) => <PostCard key={post.id} post={post} rank={index + 1} />)}
          </div>

          {feedQuery.data?.pages.map((page, index) =>
            index < feedQuery.data.pages.length - 1 || page.nextCursor
              ? <AdSlot key={`ad-${index}-${page.nextCursor ?? "last"}`} />
              : null
          )}
        </div>
      )}

      <div ref={sentinelRef} className="min-h-14" aria-hidden="true" />

      {feedQuery.isFetchingNextPage ? <FeedLoadingState compact /> : null}

      {!feedQuery.hasNextPage && posts.length > 0
        ? (
          <div className="hard-panel bg-newsprint p-4 text-center font-mono text-xs font-black uppercase">
            End of the mock feed
          </div>
        )
        : null}
    </section>
  );
}

function FeedLoadingState({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`hard-panel grid place-items-center bg-newsprint ${compact ? "h-20" : "h-56"}`}>
      <div className="flex items-center gap-3 font-mono text-sm font-black uppercase">
        <Loader2 aria-hidden="true" className="animate-spin" size={18} />
        Loading posts
      </div>
    </div>
  );
}
