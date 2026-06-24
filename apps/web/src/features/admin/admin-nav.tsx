import { Link } from "@tanstack/react-router";
import { History, ShieldCheck, Tags } from "lucide-react";
import { useTranslation } from "react-i18next";

// Switches between the console surfaces. Moderation is reactive safety work,
// History is the audit trail, and Administration is proactive site curation.
export function AdminTabs({ active }: { active: "moderation" | "history" | "administration" }) {
  const { t } = useTranslation();
  return (
    <nav className="admin-tabs" aria-label="Console sections">
      <Link
        to="/admin"
        className={active === "moderation" ? "admin-tab admin-tab--active" : "admin-tab"}
        aria-current={active === "moderation" ? "page" : undefined}
      >
        <ShieldCheck size={16} aria-hidden="true" />
        {t("admin.tab.moderation")}
      </Link>
      <Link
        to="/admin/history"
        className={active === "history" ? "admin-tab admin-tab--active" : "admin-tab"}
        aria-current={active === "history" ? "page" : undefined}
      >
        <History size={16} aria-hidden="true" />
        {t("admin.tab.history")}
      </Link>
      <Link
        to="/admin/tags"
        className={active === "administration" ? "admin-tab admin-tab--active" : "admin-tab"}
        aria-current={active === "administration" ? "page" : undefined}
      >
        <Tags size={16} aria-hidden="true" />
        {t("admin.tab.administration")}
      </Link>
    </nav>
  );
}

// Gate / loading / error state, shown before either surface is ready.
export function AdminShell({ message }: { message: string }) {
  return (
    <div className="hard-panel admin-shell-state">
      <ShieldCheck size={26} aria-hidden="true" />
      <p>{message}</p>
    </div>
  );
}
