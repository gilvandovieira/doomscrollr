import { SignInButton, SignUpButton, useAuth } from "@clerk/react";
import { useQuery } from "@tanstack/react-query";
import { Ban, CheckCircle2, EyeOff, LogIn, UserPlus } from "lucide-react";
import { fetchModerationReports } from "../../app/api.ts";
import { HAS_CLERK } from "../../app/auth.ts";

export function ModerationPage() {
  if (HAS_CLERK) {
    return <AuthenticatedModerationPage />;
  }

  return <ModerationQueue />;
}

function AuthenticatedModerationPage() {
  const { getToken, isLoaded, isSignedIn } = useAuth();

  const reportsQuery = useQuery({
    queryKey: ["moderation-reports"],
    queryFn: () => fetchModerationReports(() => getToken()),
    enabled: isLoaded && isSignedIn,
  });

  if (isLoaded && !isSignedIn) {
    return <SignedOutModerationState />;
  }

  return <ModerationQueue reportsQuery={reportsQuery} />;
}

type ReportsQuery = ReturnType<typeof useQuery<Awaited<ReturnType<typeof fetchModerationReports>>>>;

function ModerationQueue({ reportsQuery }: { reportsQuery?: ReportsQuery }) {
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

      {reportsQuery?.isError
        ? (
          <div className="hard-panel bg-oxide p-5 text-paper">
            <p className="font-mono text-xs font-black uppercase">Unable to load queue</p>
            <p className="mt-2 text-sm font-bold leading-6">
              Your session could not be verified by the API. Sign in again or check the API Clerk
              secret key.
            </p>
          </div>
        )
        : null}

      <div className="grid gap-4">
        {(reportsQuery?.data ?? []).map((report) => (
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

      {reportsQuery?.data?.length === 0
        ? (
          <div className="hard-panel bg-newsprint p-8 text-center font-mono text-sm font-black uppercase">
            No open reports
          </div>
        )
        : null}
    </section>
  );
}

function SignedOutModerationState() {
  return (
    <section className="grid min-h-[55vh] place-items-center">
      <div className="hard-panel max-w-xl bg-paper p-6">
        <p className="font-mono text-xs font-black uppercase text-oxide">Moderation</p>
        <h1 className="mt-2 font-display text-5xl uppercase leading-none">Sign in first.</h1>
        <p className="mt-3 text-sm font-bold leading-6">
          The moderation queue is protected. Use your Clerk account to review reports and content
          state.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <SignInButton mode="modal">
            <button type="button" className="tool-button">
              <LogIn aria-hidden="true" size={17} />
              Sign in
            </button>
          </SignInButton>
          <SignUpButton mode="modal">
            <button type="button" className="tool-button bg-signal">
              <UserPlus aria-hidden="true" size={17} />
              Sign up
            </button>
          </SignUpButton>
        </div>
      </div>
    </section>
  );
}
