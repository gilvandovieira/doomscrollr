import type { Comment } from "@doomscrollr/shared/types.ts";
import { MessageSquareText, Send } from "lucide-react";

type CommentThreadProps = {
  comments: Comment[];
  isLoading: boolean;
};

export function CommentThread({ comments, isLoading }: CommentThreadProps) {
  return (
    <section className="hard-panel bg-paper">
      <div className="flex items-center gap-2 border-b-2 border-ink bg-newsprint px-4 py-3">
        <MessageSquareText aria-hidden="true" size={20} />
        <h2 className="text-xl font-black uppercase">Discussion</h2>
      </div>

      <div className="space-y-4 p-4">
        <CommentComposer />

        {isLoading
          ? <p className="font-mono text-sm font-black uppercase">Loading comments</p>
          : comments.map((comment) => <CommentItem key={comment.id} comment={comment} />)}
      </div>
    </section>
  );
}

function CommentComposer() {
  return (
    <form className="grid gap-3 border-b-2 border-ink pb-4">
      <textarea
        className="min-h-28 resize-y border-2 border-ink bg-newsprint p-3 text-sm font-bold"
        placeholder="Sign in to comment"
        disabled
      />
      <button type="button" className="tool-button w-fit" disabled>
        <Send aria-hidden="true" size={17} />
        Comment
      </button>
    </form>
  );
}

function CommentItem({ comment }: { comment: Comment }) {
  return (
    <article className="border-2 border-ink bg-newsprint p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-mono text-xs font-black uppercase text-oxide">
          @{comment.author.username}
        </p>
        <p className="font-mono text-xs font-black uppercase">{comment.score} votes</p>
      </div>
      <p className="mt-2 text-sm font-bold leading-6">{comment.body}</p>

      {comment.replies.length > 0
        ? (
          <div className="mt-3 space-y-3 border-l-4 border-oxide pl-3">
            {comment.replies.map((reply) => <CommentReply key={reply.id} reply={reply} />)}
          </div>
        )
        : null}
    </article>
  );
}

function CommentReply({ reply }: { reply: Comment["replies"][number] }) {
  return (
    <article className="border-2 border-ink bg-paper p-3">
      <p className="font-mono text-xs font-black uppercase text-oxide">
        @{reply.author.username}
      </p>
      <p className="mt-2 text-sm font-bold leading-6">{reply.body}</p>
    </article>
  );
}
