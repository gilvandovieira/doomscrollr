import type { FeedPost } from "@doomscrollr/shared/types.ts";
import { Link } from "@tanstack/react-router";
import { MessageCircle } from "lucide-react";
import type { CSSProperties } from "react";
import { PostMedia } from "../../components/PostMedia.tsx";
import { ReshareControls } from "../../components/ReshareControls.tsx";
import { TagLink } from "../../components/TagLink.tsx";
import { postDisplayTitle, postKindLabel } from "../../lib/post-display.ts";

// A post reads like something just shared into a chat: who shared it, the
// content, then the reaction/discussion row.
export function PostCard({ post, index = 0 }: { post: FeedPost; index?: number }) {
  const enterStyle = { "--stagger": `${Math.min(index, 7) * 32}ms` } as CSSProperties;
  const isReshare = post.postKind === "repost" || post.postKind === "quote";
  const displayTitle = postDisplayTitle(post);

  return (
    <article
      className={`feed-card post-card feed-card--enter ${
        isReshare ? "post-card--reshare-kind" : ""
      }`}
      data-kind={post.postKind}
      style={enterStyle}
    >
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
        <span className="post-card__kind">{postKindLabel(post.postKind)}</span>
      </div>

      <Link
        to="/p/$postCode/$slug"
        params={{ postCode: post.publicCode, slug: post.slug }}
        className={`post-card__link ${isReshare ? "post-card__link--reshare" : ""}`}
      >
        {isReshare
          ? <h2 className="sr-only">{postKindLabel(post.postKind)} {displayTitle}</h2>
          : <h2 className="post-card__title">{displayTitle}</h2>}
        <PostMedia post={post} mode="card" />
      </Link>

      <div className="post-card__foot">
        {post.tags.length > 0 && (
          <div className="flex min-w-0 flex-wrap gap-1.5">
            {post.tags.map((tag) => <TagLink key={tag} slug={tag} />)}
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

      <div className="post-card__reshare">
        <ReshareControls post={post} variant="compact" />
      </div>
    </article>
  );
}
