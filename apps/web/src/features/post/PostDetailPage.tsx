import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import { useEffect } from "react";
import { fetchComments, fetchPost, sendEvent } from "../../app/api.ts";
import { PostMedia } from "../../components/PostMedia.tsx";
import { ReactionBar } from "../../components/ReactionBar.tsx";
import { ReportButton } from "../../components/ReportButton.tsx";
import { ShareControls } from "../../components/ShareControls.tsx";
import { CommentThread } from "./comments/CommentThread.tsx";

const dateFormatter = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

export function PostDetailPage() {
  const params = useParams({ strict: false }) as { postCode?: string };
  const postCode = params.postCode ?? "";

  const postQuery = useQuery({
    queryKey: ["post", postCode],
    queryFn: () => fetchPost(postCode),
    enabled: postCode.length > 0,
  });
  const commentsQuery = useQuery({
    queryKey: ["post-comments", postCode],
    queryFn: () => fetchComments(postCode),
    enabled: postCode.length > 0,
  });

  // Record the anonymous/authenticated open for the share funnel (spec §10.2).
  useEffect(() => {
    if (postCode) sendEvent("post_opened", postCode);
  }, [postCode]);

  if (postQuery.isPending) {
    return <Shell message="Loading post…" />;
  }
  if (postQuery.isError || !postQuery.data) {
    return <Shell message="This post is unavailable." />;
  }

  const post = postQuery.data;

  return (
    <article className="space-y-4">
      <div className="hard-panel">
        <div className="flex items-center justify-between gap-3 border-b border-ink/10 px-4 py-3">
          <Link
            to="/$username"
            params={{ username: `@${post.author.username}` }}
            className="inline-flex min-h-10 items-center hover:underline"
          >
            <span className="meta-label font-semibold text-ink/80">
              @{post.author.username}
            </span>
          </Link>
          <span className="meta-label">
            {dateFormatter.format(new Date(post.createdAt))}
          </span>
        </div>

        <div className="space-y-4 p-4">
          <h1 className="mobile-title">{post.title}</h1>
          <PostMedia post={post} mode="detail" />

          {post.tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {post.tags.map((tag) => (
                <span key={tag} className="tag-chip">
                  #{tag}
                </span>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <ReactionBar
              kind="post"
              code={post.publicCode}
              score={post.score}
              viewerReaction={post.viewerReaction}
            />
            <ReportButton targetType="post" targetCode={post.publicCode} />
          </div>

          <div className="border-t border-ink/10 pt-4">
            <ShareControls post={post} />
          </div>
        </div>
      </div>

      <CommentThread
        postCode={postCode}
        comments={commentsQuery.data?.items ?? []}
        isLoading={commentsQuery.isPending}
      />
    </article>
  );
}

function Shell({ message }: { message: string }) {
  return (
    <div className="hard-panel grid min-h-60 place-items-center bg-newsprint p-6">
      <p className="text-center text-sm font-black">{message}</p>
    </div>
  );
}
