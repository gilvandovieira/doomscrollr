import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import { fetchTag } from "../../app/api.ts";
import { InfinitePostList } from "../feed/InfinitePostList.tsx";
import { useTagFeed } from "../feed/useFeedQuery.ts";

export function TagPage() {
  const params = useParams({ strict: false }) as { tagSlug?: string };
  const tagSlug = params.tagSlug ?? "";

  const tagQuery = useQuery({
    queryKey: ["tag", tagSlug],
    queryFn: () => fetchTag(tagSlug),
    enabled: tagSlug.length > 0,
    staleTime: 120_000,
  });
  const feed = useTagFeed(tagSlug);

  if (tagQuery.isPending || feed.isPending) {
    return (
      <div className="space-y-3" aria-label="Loading tag">
        <div className="h-6 w-28 rounded-full bg-newsprint" />
        <div className="hard-panel h-32 animate-pulse bg-newsprint" />
        <div className="hard-panel h-52 animate-pulse bg-newsprint" />
      </div>
    );
  }

  if (tagQuery.isError || feed.isError || !tagQuery.data) {
    return (
      <div className="hard-panel p-5">
        <p className="meta-label text-oxide">Tag unavailable</p>
        <p className="mt-2 text-sm font-bold">That tag is disabled or does not exist.</p>
      </div>
    );
  }

  const { tag, requestedSlug, canonicalSlug } = tagQuery.data;
  const posts = feed.data.pages.flatMap((page) => page.items);

  return (
    <section className="space-y-4">
      <div className="tag-hero hard-panel">
        <p className="meta-label">#{tag.slug}</p>
        <h1 className="mobile-title">{tag.displayName}</h1>
        {tag.description && <p className="tag-hero__description">{tag.description}</p>}
        {requestedSlug !== canonicalSlug && (
          <Link
            to="/tags/$tagSlug"
            params={{ tagSlug: canonicalSlug }}
            className="tag-hero__alias"
          >
            Showing canonical tag #{canonicalSlug}
          </Link>
        )}
        <p className="tag-hero__count">
          {tag.postCount} {tag.postCount === 1 ? "post" : "posts"}
        </p>
      </div>

      {posts.length === 0
        ? (
          <div className="hard-panel p-5">
            <h2 className="mobile-title">No posts here yet</h2>
            <p className="mt-2 text-sm font-bold">Create the first post for this tag.</p>
          </div>
        )
        : (
          <InfinitePostList
            posts={posts}
            hasNextPage={feed.hasNextPage}
            isFetchingNextPage={feed.isFetchingNextPage}
            fetchNextPage={feed.fetchNextPage}
          />
        )}
    </section>
  );
}
