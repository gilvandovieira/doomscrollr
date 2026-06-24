import { getRouteApi } from "@tanstack/react-router";
import { postKindLabel } from "../../lib/post-display.ts";
import { InfinitePostList } from "./InfinitePostList.tsx";
import { useRecentFeed } from "./useFeedQuery.ts";

const route = getRouteApi("/");

export function FeedPage() {
  const { kind } = route.useSearch();
  const feed = useRecentFeed(kind);
  const heading = kind ? `${postKindLabel(kind)} posts` : "Fresh posts";

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
        <h1 className="mobile-title">
          {kind ? `No ${postKindLabel(kind).toLowerCase()} posts yet` : "No posts yet"}
        </h1>
        <p className="mt-2 text-sm font-bold">
          {kind
            ? "Nothing of this type so far. Try another filter."
            : "Be the first to create one."}
        </p>
      </div>
    );
  }

  return (
    <section className="space-y-4">
      <div className="px-1">
        <h1 className="mobile-title">{heading}</h1>
      </div>

      <InfinitePostList
        posts={posts}
        hasNextPage={feed.hasNextPage}
        isFetchingNextPage={feed.isFetchingNextPage}
        fetchNextPage={feed.fetchNextPage}
      />
    </section>
  );
}
