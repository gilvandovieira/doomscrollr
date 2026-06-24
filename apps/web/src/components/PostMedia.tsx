import type { FeedPost } from "@doomscrollr/shared/types.ts";

type PostMediaProps = {
  post: FeedPost;
  mode: "card" | "detail";
};

// Render a post's media by kind. v1 has no media_assets abstraction; posts carry
// their own fields (spec §8.2).
export function PostMedia({ post, mode }: PostMediaProps) {
  if (post.postKind === "external_image" && post.imageUrl) {
    return (
      <img
        src={post.imageUrl}
        alt=""
        loading="lazy"
        className={mode === "card"
          ? "max-h-[460px] w-full border-y-2 border-ink object-cover"
          : "w-full border-2 border-ink"}
      />
    );
  }

  if (post.postKind === "youtube" && post.youtubeVideoId) {
    if (mode === "detail") {
      return (
        <div className="aspect-video w-full border-2 border-ink">
          <iframe
            title={post.title}
            src={`https://www.youtube.com/embed/${post.youtubeVideoId}`}
            className="h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      );
    }
    return (
      <img
        src={`https://i.ytimg.com/vi/${post.youtubeVideoId}/hqdefault.jpg`}
        alt=""
        loading="lazy"
        className="max-h-[460px] w-full border-y-2 border-ink object-cover"
      />
    );
  }

  if (post.postKind === "text" && post.bodyText) {
    return (
      <p
        className={mode === "card"
          ? "border-y-2 border-ink bg-newsprint px-3 py-4 text-sm font-medium leading-6 line-clamp-4"
          : "whitespace-pre-wrap border-2 border-ink bg-newsprint px-4 py-4 text-base leading-7"}
      >
        {post.bodyText}
      </p>
    );
  }

  return null;
}
