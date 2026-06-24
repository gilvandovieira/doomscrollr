import { PostCard } from "./PostCard.tsx";
import { useRecentFeed } from "./useFeedQuery.ts";

export function FeedPage() {
  const feed = useRecentFeed();

  if (feed.isPending) {
    return <p className="font-mono text-sm font-black uppercase">Loading the feed…</p>;
  }

  if (feed.isError) {
    return (
      <div className="hard-panel p-5">
        <p className="font-mono text-xs font-black uppercase text-oxide">Feed unavailable</p>
        <p className="mt-2 text-sm font-bold">Could not load the recent feed. Try again shortly.</p>
      </div>
    );
  }

  const posts = feed.data.pages.flatMap((page) => page.items);

  if (posts.length === 0) {
    return (
      <div className="hard-panel p-5">
        <h1 className="font-display text-3xl uppercase leading-none">No posts yet</h1>
        <p className="mt-2 text-sm font-bold">Be the first to create one.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="font-display text-3xl uppercase leading-none">Recent</h1>
      <div className="space-y-4">
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
    </div>
  );
}
