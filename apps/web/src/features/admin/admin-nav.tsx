import { Link } from "@tanstack/react-router";
import { ShieldCheck, Tags } from "lucide-react";

// Switches between the two console surfaces. Moderation is reactive safety work
// (the report queue); Administration is proactive site curation (the tag set).
export function AdminTabs({ active }: { active: "moderation" | "administration" }) {
  return (
    <nav className="admin-tabs" aria-label="Console sections">
      <Link
        to="/admin"
        className={active === "moderation" ? "admin-tab admin-tab--active" : "admin-tab"}
        aria-current={active === "moderation" ? "page" : undefined}
      >
        <ShieldCheck size={16} aria-hidden="true" />
        Moderation
      </Link>
      <Link
        to="/admin/tags"
        className={active === "administration" ? "admin-tab admin-tab--active" : "admin-tab"}
        aria-current={active === "administration" ? "page" : undefined}
      >
        <Tags size={16} aria-hidden="true" />
        Administration
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
