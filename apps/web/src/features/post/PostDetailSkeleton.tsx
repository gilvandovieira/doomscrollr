// Placeholder shown while a post (and its thread) load. It mirrors the real
// PostDetailPage layout so the page doesn't jump when data arrives. Shapes are
// aria-hidden; one polite status line announces the load to assistive tech.
// The `animate-pulse` is neutralized by the global reduced-motion rule.

function Sk({ className }: { className?: string }) {
  return (
    <div aria-hidden="true" className={`animate-pulse rounded-md bg-ink/10 ${className ?? ""}`} />
  );
}

export function PostDetailSkeleton() {
  return (
    <article className="space-y-4" aria-busy="true">
      <span className="sr-only" role="status">Loading post…</span>

      <div className="hard-panel">
        {/* Author + date */}
        <div className="flex min-h-10 items-center justify-between gap-3 border-b border-ink/10 px-4 py-3">
          <Sk className="h-3.5 w-28 rounded-full" />
          <Sk className="h-3 w-16 rounded-full" />
        </div>

        <div className="space-y-4 p-4">
          {/* Title */}
          <div className="space-y-2">
            <Sk className="h-6 w-11/12" />
            <Sk className="h-6 w-2/3" />
          </div>

          {/* Media */}
          <Sk className="h-52 w-full rounded-2xl" />

          {/* Tags */}
          <div className="flex gap-2">
            <Sk className="h-6 w-16 rounded-full" />
            <Sk className="h-6 w-20 rounded-full" />
          </div>

          {/* Reactions + report */}
          <div className="flex items-center gap-3">
            <Sk className="h-11 w-28 rounded-full" />
            <Sk className="h-11 w-11 rounded-xl" />
          </div>

          {/* Share */}
          <div className="grid grid-cols-[1fr_1fr_auto] gap-2 border-t border-ink/10 pt-4">
            <Sk className="h-11 rounded-xl" />
            <Sk className="h-11 rounded-xl" />
            <Sk className="h-11 w-11 rounded-xl" />
          </div>
        </div>
      </div>

      {/* Discussion */}
      <div className="hard-panel">
        <div className="border-b border-ink/10 px-4 py-3">
          <Sk className="h-4 w-28" />
        </div>
        <div className="space-y-4 p-4">
          <Sk className="h-24 w-full rounded-xl" />
          {[0, 1].map((row) => (
            <div
              key={row}
              className="space-y-2 rounded-2xl border border-ink/10 bg-newsprint p-3.5"
            >
              <Sk className="h-3 w-24 rounded-full" />
              <Sk className="h-3.5 w-full" />
              <Sk className="h-3.5 w-4/5" />
            </div>
          ))}
        </div>
      </div>
    </article>
  );
}
