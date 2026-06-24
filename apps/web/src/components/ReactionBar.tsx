import { ArrowBigDown, ArrowBigUp } from "lucide-react";
import { useState } from "react";
import { useAuthToken, useIsSignedIn } from "../app/account.ts";
import { setCommentReaction, setPostReaction } from "../app/api.ts";

type ReactionBarProps = {
  kind: "post" | "comment";
  code: string;
  score: number;
  viewerReaction: 1 | -1 | null;
};

// Up/down reaction with transactional score from the server (spec §8.4).
export function ReactionBar({ kind, code, score, viewerReaction }: ReactionBarProps) {
  const signedIn = useIsSignedIn();
  const getToken = useAuthToken();
  const [state, setState] = useState<{ score: number; value: 1 | -1 | null }>({
    score,
    value: viewerReaction,
  });
  const [busy, setBusy] = useState(false);

  async function react(next: 1 | -1) {
    if (!signedIn || busy) return;
    const value = state.value === next ? 0 : next;
    setBusy(true);
    try {
      const result = kind === "post"
        ? await setPostReaction(code, value, getToken)
        : await setCommentReaction(code, value, getToken);
      setState({ score: result.score, value: result.value });
    } catch {
      // Surface nothing for v1; the score simply doesn't change.
    } finally {
      setBusy(false);
    }
  }

  const cell = (active: boolean) =>
    `flex h-9 w-9 items-center justify-center transition ${
      active ? "bg-oxide text-paper" : "hover:bg-signal"
    } ${signedIn ? "" : "cursor-not-allowed opacity-60"}`;

  return (
    <div className="inline-flex items-center border-2 border-ink bg-paper">
      <button
        type="button"
        className={cell(state.value === 1)}
        onClick={() => react(1)}
        disabled={!signedIn || busy}
        aria-pressed={state.value === 1}
        aria-label="Upvote"
        title={signedIn ? "Upvote" : "Sign in to react"}
      >
        <ArrowBigUp aria-hidden="true" size={18} />
      </button>
      <span className="min-w-9 px-1 text-center font-mono text-sm font-black">{state.score}</span>
      <button
        type="button"
        className={cell(state.value === -1)}
        onClick={() => react(-1)}
        disabled={!signedIn || busy}
        aria-pressed={state.value === -1}
        aria-label="Downvote"
        title={signedIn ? "Downvote" : "Sign in to react"}
      >
        <ArrowBigDown aria-hidden="true" size={18} />
      </button>
    </div>
  );
}
