import type { FeedPost } from "@doomscrollr/shared/types.ts";
import { Link } from "@tanstack/react-router";
import { MessageCircle } from "lucide-react";
import type { CSSProperties } from "react";
import { PostMedia } from "../../components/PostMedia.tsx";

const KIND_LABEL: Record<FeedPost["postKind"], string> = {
  text: "Text",
  external_image: "Image",
  youtube: "YouTube",
};

// A post reads like something just shared into a chat: who shared it, the
// content, then the reaction/discussion row.
export function PostCard({ post, index = 0 }: { post: FeedPost; index?: number }) {
  const enterStyle = { "--stagger": `${Math.min(index, 7) * 32}ms` } as CSSProperties;

  return (
    <article className="feed-card post-card feed-card--enter" style={enterStyle}>
      <div className="post-card__head">
        <Link
          to="/$username"
          params={{ username: `@${post.author.username}` }}
          className="post-card__avatar"
          aria-label={`@${post.author.username}`}
        >
          {post.author.avatarUrl
            ? <img src={post.author.avatarUrl} alt="" loading="lazy" />
            : post.author.username.slice(0, 1).toUpperCase()}
        </Link>
        <Link
          to="/$username"
          params={{ username: `@${post.author.username}` }}
          className="post-card__handle"
        >
          @{post.author.username}
        </Link>
        <span className="post-card__kind">{KIND_LABEL[post.postKind]}</span>
      </div>

      <Link
        to="/p/$postCode/$slug"
        params={{ postCode: post.publicCode, slug: post.slug }}
        className="post-card__link"
      >
        <h2 className="post-card__title">{post.title}</h2>
        <PostMedia post={post} mode="card" />
      </Link>

      <div className="post-card__foot">
        {post.tags.length > 0 && (
          <div className="flex min-w-0 flex-wrap gap-1.5">
            {post.tags.map((tag) => <span key={tag} className="tag-chip">#{tag}</span>)}
          </div>
        )}

        <div className="post-card__stats">
          <span>{post.score} {post.score === 1 ? "point" : "points"}</span>
          <Link
            to="/p/$postCode/$slug"
            params={{ postCode: post.publicCode, slug: post.slug }}
            className="post-card__comments"
            aria-label={`${post.commentCount} comments`}
          >
            <MessageCircle aria-hidden="true" size={16} />
            {post.commentCount}
          </Link>
        </div>
      </div>
    </article>
  );
}
