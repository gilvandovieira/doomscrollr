import { ArrowBigDown, ArrowBigUp } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuthToken, useIsSignedIn } from "../app/account.ts";
import { setCommentReaction, setPostReaction } from "../app/api.ts";

type ReactionBarProps = {
  kind: "post" | "comment";
  code: string;
  score: number;
  viewerReaction: 1 | -1 | null;
};

type VoteFlash = {
  dir: 1 | -1;
  id: number;
};

// Up/down reaction with transactional score from the server (spec §8.4).
export function ReactionBar({ kind, code, score, viewerReaction }: ReactionBarProps) {
  const { t } = useTranslation();
  const signedIn = useIsSignedIn();
  const getToken = useAuthToken();
  const [state, setState] = useState<{ score: number; value: 1 | -1 | null }>({
    score,
    value: viewerReaction,
  });
  const [voteFlash, setVoteFlash] = useState<VoteFlash | null>(null);
  const [scoreFlash, setScoreFlash] = useState<VoteFlash | null>(null);
  const [busy, setBusy] = useState(false);

  async function react(next: 1 | -1) {
    if (!signedIn || busy) return;
    const value = state.value === next ? 0 : next;
    const previousScore = state.score;
    setBusy(true);
    runVoteFlash(next);
    try {
      const result = kind === "post"
        ? await setPostReaction(code, value, getToken)
        : await setCommentReaction(code, value, getToken);
      const scoreDelta = result.score - previousScore;
      setState({ score: result.score, value: result.value });
      if (scoreDelta !== 0) {
        runScoreFlash(scoreDelta > 0 ? 1 : -1);
      }
    } catch {
      // Surface nothing for v1; the score simply doesn't change.
    } finally {
      setBusy(false);
    }
  }

  function runVoteFlash(dir: 1 | -1) {
    const flash = { dir, id: motionId() };
    setVoteFlash(flash);
    globalThis.setTimeout(() => clearVoteFlash(flash.id), 320);
  }

  function runScoreFlash(dir: 1 | -1) {
    const flash = { dir, id: motionId() };
    setScoreFlash(flash);
    globalThis.setTimeout(() => clearScoreFlash(flash.id), 320);
  }

  function clearVoteFlash(id: number) {
    setVoteFlash((current) => current?.id === id ? null : current);
  }

  function clearScoreFlash(id: number) {
    setScoreFlash((current) => current?.id === id ? null : current);
  }

  const buttonClass = (dir: 1 | -1) =>
    `react-pill__btn ${voteFlash?.dir === dir ? "react-pill__btn--pulse" : ""}`;
  const iconClass = (dir: 1 | -1) =>
    `react-pill__icon ${
      voteFlash?.dir === dir
        ? dir === 1 ? "react-pill__icon--upvote" : "react-pill__icon--downvote"
        : ""
    }`;
  const scoreClass = `react-pill__score reaction-score ${
    scoreFlash?.dir === 1
      ? "reaction-score--up"
      : scoreFlash?.dir === -1
      ? "reaction-score--down"
      : ""
  }`;

  return (
    <div className="react-pill">
      <button
        type="button"
        className={buttonClass(1)}
        data-dir="up"
        onClick={() => react(1)}
        disabled={!signedIn || busy}
        aria-pressed={state.value === 1}
        aria-label={t("react.up")}
        title={signedIn ? t("react.up") : t("react.signIn")}
      >
        <span
          key={voteFlash?.dir === 1 ? `up-${voteFlash.id}` : "up-idle"}
          className={iconClass(1)}
          onAnimationEnd={() => {
            if (voteFlash?.dir === 1) clearVoteFlash(voteFlash.id);
          }}
        >
          <ArrowBigUp aria-hidden="true" size={18} />
        </span>
      </button>
      <span
        key={`${state.score}-${scoreFlash?.id ?? "idle"}`}
        className={scoreClass}
        aria-live="polite"
        onAnimationEnd={() => {
          if (scoreFlash) clearScoreFlash(scoreFlash.id);
        }}
      >
        {state.score}
      </span>
      <button
        type="button"
        className={buttonClass(-1)}
        data-dir="down"
        onClick={() => react(-1)}
        disabled={!signedIn || busy}
        aria-pressed={state.value === -1}
        aria-label={t("react.down")}
        title={signedIn ? t("react.down") : t("react.signIn")}
      >
        <span
          key={voteFlash?.dir === -1 ? `down-${voteFlash.id}` : "down-idle"}
          className={iconClass(-1)}
          onAnimationEnd={() => {
            if (voteFlash?.dir === -1) clearVoteFlash(voteFlash.id);
          }}
        >
          <ArrowBigDown aria-hidden="true" size={18} />
        </span>
      </button>
    </div>
  );
}

function motionId() {
  return globalThis.performance?.now() ?? Date.now();
}
