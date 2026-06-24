import { REPORT_REASONS } from "@doomscrollr/shared/constants.ts";
import type { CreateReportInput } from "@doomscrollr/shared/types.ts";
import { Flag } from "lucide-react";
import { useState } from "react";
import { useAuthToken, useIsSignedIn } from "../app/account.ts";
import { createReport } from "../app/api.ts";

type ReportButtonProps = {
  targetType: CreateReportInput["targetType"];
  targetCode: string;
};

export function ReportButton({ targetType, targetCode }: ReportButtonProps) {
  const signedIn = useIsSignedIn();
  const getToken = useAuthToken();
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);

  if (!signedIn) return null;
  if (done) {
    return <span className="meta-label text-oxide">Reported</span>;
  }

  async function report(reason: CreateReportInput["reason"]) {
    setOpen(false);
    try {
      await createReport({ targetType, targetCode, reason }, getToken);
      setDone(true);
    } catch {
      // Ignore; user can retry.
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        className="icon-button"
        onClick={() => setOpen((value) => !value)}
        aria-label="Report"
      >
        <Flag aria-hidden="true" size={18} />
      </button>
      {open && (
        <div className="hard-panel absolute right-0 z-20 mt-1 w-44 overflow-hidden">
          {REPORT_REASONS.map((reason) => (
            <button
              key={reason}
              type="button"
              onClick={() => report(reason)}
              className="block min-h-10 w-full px-3 py-2 text-left text-xs font-black hover:bg-signal hover:text-pitch"
            >
              {reason.replace(/_/g, " ")}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
