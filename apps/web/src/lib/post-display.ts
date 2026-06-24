import type { FeedPost } from "@doomscrollr/shared/types.ts";

type PostLike = Pick<FeedPost, "postKind" | "title" | "repostOf">;

export function cleanReshareTitle(title: string): string {
  const clean = title.replace(/^(?:(?:Repost|Quote):\s*)+/i, "").trim();
  return clean || title;
}

export function postDisplayTitle(post: PostLike): string {
  if ((post.postKind === "repost" || post.postKind === "quote") && post.repostOf) {
    return cleanReshareTitle(post.repostOf.title);
  }
  return cleanReshareTitle(post.title);
}

export function postKindLabel(kind: FeedPost["postKind"]): string {
  if (kind === "external_image") return "Image";
  if (kind === "youtube") return "YouTube";
  if (kind === "repost") return "Reposted";
  if (kind === "quote") return "Quoted";
  return "Text";
}

export function sourceKindLabel(kind: FeedPost["postKind"]): string {
  if (kind === "external_image") return "Image";
  if (kind === "youtube") return "YouTube";
  if (kind === "text") return "Text";
  return "Post";
}
