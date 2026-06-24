import type { Comment, ReplyComment } from "@doomscrollr/shared/types.ts";
import { useQueryClient } from "@tanstack/react-query";
import { MessageSquareText, Send } from "lucide-react";
import { useState } from "react";
import { useAuthToken, useIsSignedIn } from "../../../app/account.ts";
import { createComment } from "../../../app/api.ts";
import { ReactionBar } from "../../../components/ReactionBar.tsx";
import { ReportButton } from "../../../components/ReportButton.tsx";

type CommentThreadProps = {
  postCode: string;
  comments: Comment[];
  isLoading: boolean;
};

export function CommentThread({ postCode, comments, isLoading }: CommentThreadProps) {
  return (
    <section className="hard-panel bg-paper">
      <div className="flex items-center gap-2 border-b border-ink/10 px-4 py-3">
        <MessageSquareText aria-hidden="true" size={20} />
        <h2 className="text-lg font-bold tracking-[-0.01em]">Discussion</h2>
      </div>

      <div className="space-y-4 p-4">
        <CommentComposer postCode={postCode} placeholder="Add a comment" />

        {isLoading
          ? <p className="text-sm font-black">Loading comments…</p>
          : comments.length === 0
          ? <p className="text-sm font-bold">No comments yet. Start the discussion.</p>
          : comments.map((comment) => (
            <CommentItem key={comment.publicCode} postCode={postCode} comment={comment} />
          ))}
      </div>
    </section>
  );
}

function CommentComposer(
  { postCode, parentCommentCode, placeholder, onDone }: {
    postCode: string;
    parentCommentCode?: string;
    placeholder: string;
    onDone?: () => void;
  },
) {
  const signedIn = useIsSignedIn();
  const getToken = useAuthToken();
  const queryClient = useQueryClient();
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!value.trim() || busy) return;
    setBusy(true);
    try {
      await createComment(postCode, { bodyText: value.trim(), parentCommentCode }, getToken);
      setValue("");
      await queryClient.invalidateQueries({ queryKey: ["post-comments", postCode] });
      await queryClient.invalidateQueries({ queryKey: ["post", postCode] });
      onDone?.();
    } catch {
      // Leave the text in place so the user can retry.
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="grid gap-2" onSubmit={submit}>
      <textarea
        className="field-control min-h-24 resize-y p-3 text-sm disabled:opacity-60"
        placeholder={signedIn ? placeholder : "Sign in to comment"}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        disabled={!signedIn || busy}
        maxLength={2000}
      />
      <button
        type="submit"
        className="tool-button w-fit"
        disabled={!signedIn || busy || !value.trim()}
      >
        <Send aria-hidden="true" size={17} />
        {busy ? "Posting…" : "Comment"}
      </button>
    </form>
  );
}

function CommentItem({ postCode, comment }: { postCode: string; comment: Comment }) {
  const [replying, setReplying] = useState(false);
  const signedIn = useIsSignedIn();

  return (
    <article className="rounded-2xl border border-ink/10 bg-newsprint p-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="meta-label font-semibold text-ink/80">
          @{comment.author.username}
        </span>
        <ReportButton targetType="comment" targetCode={comment.publicCode} />
      </div>
      <p className="mt-2 whitespace-pre-wrap text-sm font-bold leading-6">{comment.bodyText}</p>

      <div className="mt-2 flex items-center gap-2">
        <ReactionBar
          kind="comment"
          code={comment.publicCode}
          score={comment.score}
          viewerReaction={comment.viewerReaction}
        />
        {signedIn && (
          <button
            type="button"
            className="meta-label hover:underline"
            onClick={() => setReplying((value) => !value)}
          >
            {replying ? "Cancel" : "Reply"}
          </button>
        )}
      </div>

      {replying && (
        <div className="comment-reply-box mt-3 rounded-lg bg-paper/70 p-3">
          <CommentComposer
            postCode={postCode}
            parentCommentCode={comment.publicCode}
            placeholder="Write a reply"
            onDone={() => setReplying(false)}
          />
        </div>
      )}

      {comment.replies.length > 0 && (
        <div className="mt-3 space-y-3 pl-3">
          {comment.replies.map((reply) => <CommentReply key={reply.publicCode} reply={reply} />)}
        </div>
      )}
    </article>
  );
}

function CommentReply({ reply }: { reply: ReplyComment }) {
  return (
    <article className="rounded-xl border border-ink/10 bg-paper p-3.5">
      <div className="flex items-center justify-between gap-2">
        <span className="meta-label font-semibold text-ink/80">
          @{reply.author.username}
        </span>
        <ReportButton targetType="comment" targetCode={reply.publicCode} />
      </div>
      <p className="mt-2 whitespace-pre-wrap text-sm font-bold leading-6">{reply.bodyText}</p>
      <div className="mt-2">
        <ReactionBar
          kind="comment"
          code={reply.publicCode}
          score={reply.score}
          viewerReaction={reply.viewerReaction}
        />
      </div>
    </article>
  );
}
