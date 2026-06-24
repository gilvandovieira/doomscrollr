import { useQuery } from "@tanstack/react-query";
import { Ban, CheckCircle2, EyeOff } from "lucide-react";
import { fetchModerationReports } from "../../app/api.ts";

export function ModerationPage() {
  const reportsQuery = useQuery({
    queryKey: ["moderation-reports"],
    queryFn: fetchModerationReports,
  });

  return (
    <section className="space-y-5">
      <div className="grid gap-3 border-b-2 border-ink pb-4 md:grid-cols-[1fr_auto] md:items-end">
        <div>
          <p className="font-mono text-xs font-black uppercase text-oxide">Moderation</p>
          <h1 className="font-display text-5xl uppercase leading-none">Queue before chaos.</h1>
        </div>
        <p className="max-w-md text-sm font-bold leading-6">
          Reports, ad safety, and content state are first-release product surface, not an
          afterthought.
        </p>
      </div>

      <div className="grid gap-4">
        {(reportsQuery.data ?? []).map((report) => (
          <article
            key={report.id}
            className="hard-panel grid gap-4 bg-paper p-4 md:grid-cols-[1fr_auto]"
          >
            <div>
              <p className="font-mono text-xs font-black uppercase text-oxide">
                {report.reason.replace("_", " ")} / {report.targetType}
              </p>
              <h2 className="mt-1 text-2xl font-black">{report.targetId}</h2>
              <p className="mt-2 text-sm font-bold leading-6">{report.details}</p>
              <p className="mt-3 font-mono text-xs font-black uppercase">
                Reported by @{report.reporter.username}
              </p>
            </div>
            <div className="flex flex-wrap items-start gap-2">
              <button type="button" className="icon-button" aria-label="Dismiss report">
                <CheckCircle2 aria-hidden="true" size={18} />
              </button>
              <button type="button" className="icon-button" aria-label="Hide content">
                <EyeOff aria-hidden="true" size={18} />
              </button>
              <button type="button" className="icon-button" aria-label="Restrict user">
                <Ban aria-hidden="true" size={18} />
              </button>
            </div>
          </article>
        ))}
      </div>

      {reportsQuery.data?.length === 0
        ? (
          <div className="hard-panel bg-newsprint p-8 text-center font-mono text-sm font-black uppercase">
            No open reports
          </div>
        )
        : null}
    </section>
  );
}
