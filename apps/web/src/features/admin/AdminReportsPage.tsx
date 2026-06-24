import type { Report } from "@doomscrollr/shared/types.ts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthToken, useIsSignedIn } from "../../app/account.ts";
import { adminAction, ApiError, fetchAdminReports } from "../../app/api.ts";

export function AdminReportsPage() {
  const signedIn = useIsSignedIn();
  const getToken = useAuthToken();
  const queryClient = useQueryClient();

  const reportsQuery = useQuery({
    queryKey: ["admin-reports"],
    queryFn: () => fetchAdminReports(getToken),
    enabled: signedIn,
    retry: false,
  });

  async function run(path: string) {
    try {
      await adminAction(path, getToken);
      await queryClient.invalidateQueries({ queryKey: ["admin-reports"] });
    } catch {
      // Ignore; the list refresh will reflect reality.
    }
  }

  if (!signedIn) return <Shell message="Sign in as an admin to view reports." />;
  if (reportsQuery.isPending) return <Shell message="Loading reports…" />;
  if (reportsQuery.isError) {
    const message = reportsQuery.error instanceof ApiError && reportsQuery.error.status === 403
      ? "Admin access required."
      : "Could not load reports.";
    return <Shell message={message} />;
  }

  const reports = reportsQuery.data;

  return (
    <section className="space-y-4">
      <h1 className="font-display text-3xl uppercase leading-none">Open reports</h1>
      {reports.length === 0
        ? <div className="hard-panel p-5"><p className="text-sm font-bold">No open reports.</p></div>
        : (
          <div className="space-y-3">
            {reports.map((report) => (
              <ReportRow key={report.id} report={report} onAction={run} />
            ))}
          </div>
        )}
    </section>
  );
}

function ReportRow({ report, onAction }: { report: Report; onAction: (path: string) => void }) {
  const code = report.targetCode;
  return (
    <article className="hard-panel space-y-2 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-xs font-black uppercase">
        <span className="text-oxide">{report.targetType}: {code}</span>
        <span>by @{report.reporter.username}</span>
      </div>
      <p className="text-sm font-bold">
        {report.reason.replace(/_/g, " ")}
        {report.details ? ` — ${report.details}` : ""}
      </p>
      <div className="flex flex-wrap gap-2">
        {report.targetType === "post" && (
          <>
            <button type="button" className="tool-button" onClick={() => onAction(`posts/${code}/remove`)}>
              Remove post
            </button>
            <button type="button" className="tool-button" onClick={() => onAction(`posts/${code}/restore`)}>
              Restore post
            </button>
          </>
        )}
        {report.targetType === "comment" && (
          <>
            <button type="button" className="tool-button" onClick={() => onAction(`comments/${code}/remove`)}>
              Remove comment
            </button>
            <button type="button" className="tool-button" onClick={() => onAction(`comments/${code}/restore`)}>
              Restore comment
            </button>
          </>
        )}
        <button
          type="button"
          className="tool-button bg-signal"
          onClick={() => onAction(`reports/${report.id}/dismiss`)}
        >
          Dismiss
        </button>
      </div>
    </article>
  );
}

function Shell({ message }: { message: string }) {
  return (
    <div className="hard-panel grid min-h-60 place-items-center bg-newsprint p-6">
      <p className="font-mono text-sm font-black uppercase">{message}</p>
    </div>
  );
}
