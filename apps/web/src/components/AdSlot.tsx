export function AdSlot() {
  return (
    <div className="hard-panel flex min-h-28 items-center justify-between gap-4 bg-newsprint p-4">
      <div>
        <p className="font-mono text-xs font-black uppercase text-oxide">Sponsored</p>
        <p className="mt-1 text-sm font-bold text-ink">
          Feed placement waits for safe, reviewed content.
        </p>
      </div>
      <div className="hidden h-14 w-28 border-2 border-dashed border-ink bg-paper sm:block" />
    </div>
  );
}
