import type { FeedPost } from "@doomscrollr/shared/types.ts";
import type { CSSProperties } from "react";
import { useEffect, useRef } from "react";
import { PostCard } from "./PostCard.tsx";

type InfinitePostListProps = {
  posts: FeedPost[];
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void | Promise<unknown>;
};

export function InfinitePostList({
  posts,
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
}: InfinitePostListProps) {
  const nextPageRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const node = nextPageRef.current;
    if (!node || !hasNextPage) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting && !isFetchingNextPage) {
          void fetchNextPage();
        }
      },
      { rootMargin: "420px 0px 520px" },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  return (
    <>
      <div className="feed-list">
        {posts.map((post, index) => <PostCard key={post.publicCode} post={post} index={index} />)}
      </div>

      {hasNextPage && (
        <div ref={nextPageRef} className="feed-next" aria-live="polite">
          {isFetchingNextPage ? <NextPostsLoading /> : (
            <button
              type="button"
              className="tool-button w-full"
              onClick={() => void fetchNextPage()}
            >
              Load more posts
            </button>
          )}
        </div>
      )}
    </>
  );
}

function NextPostsLoading() {
  return (
    <div className="feed-next__loading" aria-label="Loading more posts">
      <div className="feed-next__status">
        <span className="feed-next__pulse" aria-hidden="true" />
        <span>Loading more posts</span>
      </div>
      <div className="feed-next__skeletons">
        {Array.from({ length: 2 }, (_, index) => (
          <article
            key={index}
            className="feed-card feed-card--loading"
            style={{ "--stagger": `${index * 54}ms` } as CSSProperties}
            aria-hidden="true"
          >
            <div className="feed-card-skeleton__head">
              <span className="feed-card-skeleton__avatar" />
              <span className="feed-card-skeleton__line feed-card-skeleton__line--handle" />
              <span className="feed-card-skeleton__chip" />
            </div>
            <div className="feed-card-skeleton__body">
              <span className="feed-card-skeleton__line feed-card-skeleton__line--title" />
              <span className="feed-card-skeleton__line feed-card-skeleton__line--short" />
            </div>
            <div className="feed-card-skeleton__foot">
              <span className="feed-card-skeleton__tag" />
              <span className="feed-card-skeleton__meta" />
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
