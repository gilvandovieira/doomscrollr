import type { FeedPost } from "@doomscrollr/shared/types.ts";
import { Link } from "@tanstack/react-router";
import { MessageCircle } from "lucide-react";
import { PostMedia } from "../../components/PostMedia.tsx";

const KIND_LABEL: Record<FeedPost["postKind"], string> = {
  text: "Text",
  external_image: "Image",
  youtube: "YouTube",
};

export function PostCard({ post }: { post: FeedPost }) {
  return (
    <article className="feed-card">
      <div className="flex items-center justify-between border-b-2 border-ink bg-newsprint px-3 py-2">
        <Link
          to="/$username"
          params={{ username: `@${post.author.username}` }}
          className="truncate font-mono text-xs font-black uppercase hover:underline"
        >
          @{post.author.username}
        </Link>
        <span className="font-mono text-[11px] font-black uppercase text-oxide">
          {KIND_LABEL[post.postKind]}
        </span>
      </div>

      <Link
        to="/p/$postCode/$slug"
        params={{ postCode: post.publicCode, slug: post.slug }}
        className="block"
      >
        <h2 className="px-3 pt-3 text-xl font-black leading-tight hover:underline">{post.title}</h2>
        <PostMedia post={post} mode="card" />
      </Link>

      <div className="space-y-3 p-3">
        {post.tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {post.tags.map((tag) => (
              <span
                key={tag}
                className="border-2 border-ink bg-cyan px-2 py-1 font-mono text-[11px] font-black uppercase text-ink"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-xs font-black uppercase">
            {post.score} {post.score === 1 ? "point" : "points"}
          </span>
          <Link
            to="/p/$postCode/$slug"
            params={{ postCode: post.publicCode, slug: post.slug }}
            className="inline-flex items-center gap-1 font-mono text-xs font-black uppercase hover:underline"
          >
            <MessageCircle aria-hidden="true" size={16} />
            {post.commentCount}
          </Link>
        </div>
      </div>
    </article>
  );
}
