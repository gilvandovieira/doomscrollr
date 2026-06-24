import type { FeedPost } from "@doomscrollr/shared/types.ts";
import { Link } from "@tanstack/react-router";
import { Flag, MessageCircle, Share2 } from "lucide-react";
import { MediaRenderer } from "../../components/MediaRenderer.tsx";
import { VoteButton } from "../../components/VoteButton.tsx";

type PostCardProps = {
  post: FeedPost;
  rank: number;
};

export function PostCard({ post, rank }: PostCardProps) {
  return (
    <article className="feed-card">
      <div className="flex items-center justify-between border-b-2 border-ink bg-newsprint px-3 py-2">
        <span className="font-mono text-xs font-black uppercase text-oxide">
          #{String(rank).padStart(2, "0")}
        </span>
        <Link
          to="/$username"
          params={{ username: `@${post.author.username}` }}
          className="truncate font-mono text-xs font-black uppercase hover:underline"
        >
          @{post.author.username}
        </Link>
      </div>

      <Link to="/post/$postId" params={{ postId: post.id }} className="block">
        <MediaRenderer media={post.media} mode="card" />
      </Link>

      <div className="space-y-3 p-3">
        <Link
          to="/post/$postId"
          params={{ postId: post.id }}
          className="block text-xl font-black leading-tight hover:underline"
        >
          {post.title}
        </Link>

        <div className="flex flex-wrap gap-2">
          {post.tags.map((tag) => (
            <span
              key={tag}
              className="border-2 border-ink bg-cyan px-2 py-1 font-mono text-[11px] font-black uppercase text-ink"
            >
              {tag}
            </span>
          ))}
        </div>

        <div className="flex items-center justify-between gap-2">
          <VoteButton score={post.score} compact />
          <div className="flex items-center gap-2">
            <Link
              to="/post/$postId"
              params={{ postId: post.id }}
              className="icon-button"
              aria-label={`${post.commentCount} comments`}
            >
              <MessageCircle aria-hidden="true" size={18} />
            </Link>
            <button type="button" className="icon-button" aria-label="Share post">
              <Share2 aria-hidden="true" size={18} />
            </button>
            <button type="button" className="icon-button" aria-label="Report post">
              <Flag aria-hidden="true" size={18} />
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
