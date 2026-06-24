import { ArrowDown, ArrowUp } from "lucide-react";

type VoteButtonProps = {
  score: number;
  compact?: boolean;
};

export function VoteButton({ score, compact = false }: VoteButtonProps) {
  return (
    <div
      className={`flex items-center border-2 border-ink bg-paper ${compact ? "h-10" : "h-12"}`}
      aria-label={`${score} votes`}
    >
      <button type="button" className="icon-button h-full border-0 border-r-2" aria-label="Upvote">
        <ArrowUp aria-hidden="true" size={18} strokeWidth={3} />
      </button>
      <span className="min-w-14 px-2 text-center font-mono text-sm font-black">{score}</span>
      <button
        type="button"
        className="icon-button h-full border-0 border-l-2"
        aria-label="Downvote"
      >
        <ArrowDown aria-hidden="true" size={18} strokeWidth={3} />
      </button>
    </div>
  );
}
