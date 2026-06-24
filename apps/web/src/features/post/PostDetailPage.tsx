import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import { Flag, MessageCircle, Share2 } from "lucide-react";
import { fetchComments, fetchPost } from "../../app/api.ts";
import { MediaRenderer } from "../../components/MediaRenderer.tsx";
import { VoteButton } from "../../components/VoteButton.tsx";
import { CommentThread } from "./comments/CommentThread.tsx";

const detailDateFormatter = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

export function PostDetailPage() {
  const params = useParams({ strict: false }) as { postId?: string };
  const postId = params.postId ?? "";
  const postQuery = useQuery({
    queryKey: ["post", postId],
    queryFn: () => fetchPost(postId),
    enabled: postId.length > 0,
  });
  const commentsQuery = useQuery({
    queryKey: ["post-comments", postId],
    queryFn: () => fetchComments(postId),
    enabled: postId.length > 0,
  });

  if (postQuery.isLoading) {
    return <PostShell message="Loading post" />;
  }

  if (postQuery.isError || !postQuery.data) {
    return <PostShell message="Post not found" />;
  }

  const post = postQuery.data;

  return (
    <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
      <article className="space-y-4">
        <div className="hard-panel overflow-hidden">
          <MediaRenderer media={post.media} mode="detail" />
          <div className="space-y-4 border-t-2 border-ink bg-paper p-4">
            <div className="flex flex-wrap items-start gap-3">
              <VoteButton score={post.score} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 font-mono text-xs font-black uppercase text-oxide">
                  <Link to="/$username" params={{ username: `@${post.author.username}` }}>
                    @{post.author.username}
                  </Link>
                  <span>{detailDateFormatter.format(new Date(post.createdAt))}</span>
                  <span>{post.media.provider}</span>
                </div>
                <h1 className="mt-2 text-3xl font-black leading-tight sm:text-4xl">{post.title}</h1>
              </div>
            </div>

            {post.body
              ? <p className="max-w-3xl text-sm font-bold leading-6">{post.body}</p>
              : null}

            <div className="flex flex-wrap gap-2">
              <button type="button" className="tool-button">
                <MessageCircle aria-hidden="true" size={18} />
                {post.commentCount} comments
              </button>
              <button type="button" className="icon-button" aria-label="Share post">
                <Share2 aria-hidden="true" size={18} />
              </button>
              <button type="button" className="icon-button" aria-label="Report post">
                <Flag aria-hidden="true" size={18} />
              </button>
            </div>
          </div>
        </div>

        <CommentThread
          comments={commentsQuery.data?.items ?? []}
          isLoading={commentsQuery.isLoading}
        />
      </article>

      <aside className="space-y-4">
        <div className="hard-panel bg-newsprint p-4">
          <p className="font-mono text-xs font-black uppercase text-oxide">Ad status</p>
          <p className="mt-2 text-2xl font-black uppercase">
            {post.monetizationStatus.replace("_", " ")}
          </p>
          <p className="mt-2 text-sm font-bold leading-6">
            Safety score{" "}
            {(post.adSafetyScore * 100).toFixed(0)}. Ads render only after the content is safe.
          </p>
        </div>
      </aside>
    </section>
  );
}

function PostShell({ message }: { message: string }) {
  return (
    <div className="hard-panel grid min-h-80 place-items-center bg-newsprint p-6">
      <p className="font-mono text-sm font-black uppercase">{message}</p>
    </div>
  );
}
