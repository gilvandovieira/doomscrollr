import type { FeedPost } from "@doomscrollr/shared/types.ts";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { cleanReshareTitle, sourceKindLabel } from "../lib/post-display.ts";
import { YouTubeEmbed } from "./YouTubeEmbed.tsx";

type PostMediaProps = {
  post: FeedPost;
  mode: "card" | "detail";
};

type SourcePost = NonNullable<FeedPost["repostOf"]>;

// Render a post's media by kind. v1 has no media_assets abstraction; posts carry
// their own fields (spec §8.2).
export function PostMedia({ post, mode }: PostMediaProps) {
  if (post.postKind === "repost" || post.postKind === "quote") {
    return (
      <div className={`reshare-media reshare-media--${mode} reshare-media--${post.postKind}`}>
        {post.postKind === "quote" && post.bodyText && (
          <p
            className={mode === "card"
              ? "reshare-media__quote line-clamp-4"
              : "reshare-media__quote"}
          >
            {post.bodyText}
          </p>
        )}
        {post.repostOf
          ? <SourcePostPreview post={post.repostOf} mode={mode} />
          : <p className="source-post source-post--missing">Original post unavailable.</p>}
      </div>
    );
  }

  if (post.postKind === "external_image" && post.imageUrl) {
    return (
      <img
        src={post.imageUrl}
        alt=""
        loading="lazy"
        className={mode === "card"
          ? "aspect-video w-full object-cover"
          : "w-full rounded-2xl border border-ink/10"}
      />
    );
  }

  if (post.postKind === "youtube" && post.youtubeVideoId) {
    if (mode === "detail") {
      return <YouTubeEmbed videoId={post.youtubeVideoId} title={post.title} />;
    }
    return (
      <img
        src={`https://i.ytimg.com/vi/${post.youtubeVideoId}/hqdefault.jpg`}
        alt=""
        loading="lazy"
        className="aspect-video w-full object-cover"
      />
    );
  }

  if (post.postKind === "text" && post.bodyText) {
    return (
      <p
        className={mode === "card"
          ? "bg-newsprint px-4 py-3.5 text-sm leading-6 line-clamp-4"
          : "whitespace-pre-wrap rounded-2xl bg-newsprint px-4 py-4 text-base leading-7"}
      >
        {post.bodyText}
      </p>
    );
  }

  return null;
}

function SourcePostPreview({ post, mode }: { post: SourcePost; mode: "card" | "detail" }) {
  const { t } = useTranslation();
  const preview = (
    <div className={`source-post source-post--${mode}`}>
      <div className="source-post__meta">
        <span>{t("post.from", { user: post.author.username })}</span>
        <span aria-hidden="true">·</span>
        <span>{sourceKindLabel(post.postKind, t)}</span>
      </div>
      <p className="source-post__title">{cleanReshareTitle(post.title)}</p>
      <SourcePostBody post={post} />
    </div>
  );

  if (mode === "detail") {
    return (
      <Link
        to="/p/$postCode/$slug"
        params={{ postCode: post.publicCode, slug: post.slug }}
        className="source-post__link"
      >
        {preview}
      </Link>
    );
  }

  return preview;
}

function SourcePostBody({ post }: { post: SourcePost }) {
  if (post.postKind === "external_image" && post.imageUrl) {
    return <img src={post.imageUrl} alt="" loading="lazy" className="source-post__image" />;
  }

  if (post.postKind === "youtube" && post.youtubeVideoId) {
    return (
      <img
        src={`https://i.ytimg.com/vi/${post.youtubeVideoId}/hqdefault.jpg`}
        alt=""
        loading="lazy"
        className="source-post__image"
      />
    );
  }

  if ((post.postKind === "text" || post.postKind === "quote") && post.bodyText) {
    return <p className="source-post__body line-clamp-3">{post.bodyText}</p>;
  }

  return null;
}
