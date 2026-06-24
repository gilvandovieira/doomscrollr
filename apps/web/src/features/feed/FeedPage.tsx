import { PostCard } from "./PostCard.tsx";
import { useRecentFeed } from "./useFeedQuery.ts";

export function FeedPage() {
  const feed = useRecentFeed();

  if (feed.isPending) {
    return (
      <div className="space-y-3" aria-label="Loading feed">
        <div className="h-6 w-36 rounded-full bg-newsprint" />
        <div className="hard-panel h-56 animate-pulse bg-newsprint" />
        <div className="hard-panel h-44 animate-pulse bg-newsprint" />
      </div>
    );
  }

  if (feed.isError) {
    return (
      <div className="hard-panel p-5">
        <p className="meta-label text-oxide">Feed unavailable</p>
        <p className="mt-2 text-sm font-bold">Could not load the recent feed. Try again shortly.</p>
      </div>
    );
  }

  const posts = feed.data.pages.flatMap((page) => page.items);

  if (posts.length === 0) {
    return (
      <div className="hard-panel p-5">
        <h1 className="mobile-title">No posts yet</h1>
        <p className="mt-2 text-sm font-bold">Be the first to create one.</p>
      </div>
    );
  }

  return (
    <section className="space-y-4">
      <div className="px-1">
        <h1 className="mobile-title">Fresh posts</h1>
      </div>

      <div className="space-y-3">
        {posts.map((post) => <PostCard key={post.publicCode} post={post} />)}
      </div>
      {feed.hasNextPage && (
        <button
          type="button"
          className="tool-button w-full"
          onClick={() => feed.fetchNextPage()}
          disabled={feed.isFetchingNextPage}
        >
          {feed.isFetchingNextPage ? "Loading…" : "Load more"}
        </button>
      )}
    </section>
  );
}
