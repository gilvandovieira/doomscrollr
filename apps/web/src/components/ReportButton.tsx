import { REPORT_REASONS } from "@doomscrollr/shared/constants.ts";
import type { CreateReportInput } from "@doomscrollr/shared/types.ts";
import { Flag } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuthToken, useIsSignedIn } from "../app/account.ts";
import { createReport } from "../app/api.ts";

type ReportButtonProps = {
  targetType: CreateReportInput["targetType"];
  targetCode: string;
};

export function ReportButton({ targetType, targetCode }: ReportButtonProps) {
  const { t } = useTranslation();
  const signedIn = useIsSignedIn();
  const getToken = useAuthToken();
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);
  const menuId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const firstReasonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const frame = globalThis.requestAnimationFrame(() => firstReasonRef.current?.focus());
    return () => globalThis.cancelAnimationFrame(frame);
  }, [open]);

  if (!signedIn) return null;
  if (done) {
    return <span className="meta-label text-oxide">{t("report.reported")}</span>;
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

  function closeMenu() {
    setOpen(false);
    globalThis.requestAnimationFrame(() => triggerRef.current?.focus());
  }

  return (
    <div
      className="relative"
      onKeyDown={(event) => {
        if (!open || event.key !== "Escape") return;
        event.preventDefault();
        closeMenu();
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        className="icon-button"
        onClick={() => setOpen((value) => !value)}
        aria-label={t("report.button")}
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
      >
        <Flag aria-hidden="true" size={18} />
      </button>
      {open && (
        <div
          id={menuId}
          className="hard-panel absolute right-0 z-20 mt-1 w-44 overflow-hidden"
          role="group"
          aria-label="Report reason"
        >
          {REPORT_REASONS.map((reason, index) => (
            <button
              key={reason}
              ref={index === 0 ? firstReasonRef : undefined}
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
