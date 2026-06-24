import { REPORT_REASONS } from "@doomscrollr/shared/constants.ts";
import type {
  AdminDomainBlock,
  AdminReportListQuery,
  AdminTag,
  CreateAdminTagInput,
  CreateDomainBlockInput,
  ModerationAuditEvent,
  Report,
  UserStatus,
  UserTrustLevel,
} from "@doomscrollr/shared/types.ts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Ban,
  CheckCircle2,
  ClipboardCheck,
  Filter,
  GitMerge,
  Globe2,
  History,
  Plus,
  Power,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  StickyNote,
  Tags,
  Trash2,
} from "lucide-react";
import type { FormEvent } from "react";
import { useState } from "react";
import { useAuthToken, useIsSignedIn } from "../../app/account.ts";
import { AdminTabs } from "./admin-nav.tsx";
import {
  adminAction,
  ApiError,
  bulkReportAction,
  createAdminDomainBlock,
  createAdminTag,
  createModerationNote,
  deleteAdminDomainBlock,
  fetchAdminDomainBlocks,
  fetchAdminReports,
  fetchAdminTags,
  fetchModerationAudit,
  setUserModerationStatus,
  setUserTrustLevel,
} from "../../app/api.ts";

type ReportFilters = AdminReportListQuery;

const STATUS_OPTIONS: Array<{ value: ReportFilters["status"]; label: string }> = [
  { value: "open", label: "Open" },
  { value: "all", label: "All" },
  { value: "dismissed", label: "Dismissed" },
  { value: "actioned", label: "Actioned" },
];

const TARGET_OPTIONS: Array<{ value: ReportFilters["targetType"]; label: string }> = [
  { value: "all", label: "All targets" },
  { value: "post", label: "Posts" },
  { value: "comment", label: "Comments" },
  { value: "user", label: "Users" },
];

const USER_STATUS_OPTIONS: Array<{ value: UserStatus; label: string }> = [
  { value: "active", label: "Activate" },
  { value: "limited", label: "Limit" },
  { value: "suspended", label: "Suspend" },
  { value: "banned", label: "Ban" },
];

const USER_TRUST_LEVEL_OPTIONS: Array<{ value: UserTrustLevel; label: string }> = [
  { value: "new", label: "New" },
  { value: "normal", label: "Normal" },
  { value: "trusted", label: "Trusted" },
  { value: "limited", label: "Limited" },
  { value: "moderator", label: "Moderator" },
  { value: "admin", label: "Admin" },
];

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export function AdminReportsPage() {
  const signedIn = useIsSignedIn();
  const getToken = useAuthToken();
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<ReportFilters>({
    status: "open",
    targetType: "all",
    reason: "all",
  });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [bulkNote, setBulkNote] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [domainError, setDomainError] = useState<string | null>(null);

  const reportsQuery = useQuery({
    queryKey: ["admin-reports", filters],
    queryFn: () => fetchAdminReports(getToken, filters),
    enabled: signedIn,
    retry: false,
  });
  const auditQuery = useQuery({
    queryKey: ["moderation-audit"],
    queryFn: () => fetchModerationAudit(getToken),
    enabled: signedIn,
    retry: false,
  });
  const domainBlocksQuery = useQuery({
    queryKey: ["admin-domain-blocks"],
    queryFn: () => fetchAdminDomainBlocks(getToken),
    enabled: signedIn,
    retry: false,
  });

  async function refreshModeration() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["admin-reports"] }),
      queryClient.invalidateQueries({ queryKey: ["moderation-audit"] }),
    ]);
  }

  async function run(path: string, body?: unknown) {
    setActionError(null);
    try {
      await adminAction(path, getToken, body);
      await refreshModeration();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Moderation action failed.");
    }
  }

  async function runBulk(status: "dismissed" | "actioned") {
    const reportIds = [...selectedIds];
    if (reportIds.length === 0) return;
    setActionError(null);
    try {
      await bulkReportAction({
        reportIds,
        status,
        note: bulkNote.trim() || undefined,
      }, getToken);
      setSelectedIds(new Set());
      setBulkNote("");
      await refreshModeration();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Bulk action failed.");
    }
  }

  async function addNote(report: Report, bodyText: string) {
    setActionError(null);
    try {
      await createModerationNote({
        targetType: report.targetType,
        targetCode: report.targetCode,
        bodyText,
      }, getToken);
      await refreshModeration();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Could not save note.");
    }
  }

  async function updateUserStatus(report: Report, status: UserStatus) {
    setActionError(null);
    try {
      await setUserModerationStatus(report.targetCode, {
        status,
        reason: "Changed from the report queue.",
      }, getToken);
      await refreshModeration();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Could not update user status.");
    }
  }

  async function updateUserTrustLevel(report: Report, trustLevel: UserTrustLevel) {
    setActionError(null);
    try {
      await setUserTrustLevel(report.targetCode, {
        trustLevel,
        reason: "Changed from the report queue.",
      }, getToken);
      await refreshModeration();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Could not update trust level.");
    }
  }

  async function refreshDomainBlocks() {
    await queryClient.invalidateQueries({ queryKey: ["admin-domain-blocks"] });
  }

  async function createDomainBlock(input: CreateDomainBlockInput) {
    setDomainError(null);
    try {
      await createAdminDomainBlock(input, getToken);
      await refreshDomainBlocks();
    } catch (err) {
      setDomainError(err instanceof ApiError ? err.message : "Could not block domain.");
    }
  }

  async function deleteDomainBlock(domain: string) {
    setDomainError(null);
    try {
      await deleteAdminDomainBlock(domain, getToken);
      await refreshDomainBlocks();
    } catch (err) {
      setDomainError(err instanceof ApiError ? err.message : "Could not unblock domain.");
    }
  }

  function updateFilter<K extends keyof ReportFilters>(key: K, value: ReportFilters[K]) {
    setSelectedIds(new Set());
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function toggleReport(reportId: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(reportId)) next.delete(reportId);
      else next.add(reportId);
      return next;
    });
  }

  if (!signedIn) {
    return (
      <Shell message="Sign in with an admin account. The server checks admin role before every moderation action." />
    );
  }
  if (reportsQuery.isPending || domainBlocksQuery.isPending) {
    return <Shell message="Loading the moderation queue and policy tools." />;
  }
  if (reportsQuery.isError || domainBlocksQuery.isError) {
    const error = reportsQuery.error ?? domainBlocksQuery.error;
    const message = error instanceof ApiError && error.status === 403
      ? "Admin access required. This console is gated by server-verified role."
      : "Could not load admin data. Reports, domain policy, and audit history stay unavailable until the read succeeds.";
    return <Shell message={message} />;
  }

  const reports = reportsQuery.data;
  const domainBlocks = domainBlocksQuery.data;
  const visibleSelectedCount = reports.filter((report) => selectedIds.has(report.id)).length;
  const openCount = reports.filter((report) => report.status === "open").length;
  const actionedCount = reports.filter((report) => report.status === "actioned").length;
  const userCaseCount = reports.filter((report) => report.targetType === "user").length;
  const auditEvents = auditQuery.data ?? [];

  return (
    <section className="admin-workbench">
      <AdminTabs active="moderation" />

      <header className="admin-workbench__masthead">
        <div className="admin-workbench__identity">
          <p className="meta-label">Moderator console</p>
          <h1 className="mobile-title admin-workbench__title">Admin docket</h1>
          <p className="admin-workbench__summary">
            Keep the SFW WhatsApp loop safe without turning moderation into a separate product.
            Reports should end in a clear content decision, a user decision, or a documented
            dismissal.
          </p>
        </div>
        <dl className="admin-case-tape" aria-label="Visible queue summary">
          <div className="admin-case-tape__item admin-case-tape__item--open">
            <dt>Open</dt>
            <dd>{openCount}</dd>
          </div>
          <div className="admin-case-tape__item">
            <dt>Actioned</dt>
            <dd>{actionedCount}</dd>
          </div>
          <div className="admin-case-tape__item">
            <dt>User cases</dt>
            <dd>{userCaseCount}</dd>
          </div>
          <div className="admin-case-tape__item">
            <dt>Selected</dt>
            <dd>{visibleSelectedCount}</dd>
          </div>
        </dl>
      </header>

      <section className="admin-policy-brief" aria-label="Moderation policy brief">
        <p>
          <strong>SFW-only means remove, not gate.</strong>{" "}
          Confirmed unsafe, spam, harassment, nudity, hate, or suggestive-beyond-policy content
          should be removed. Removed posts fall back to the unavailable page and a safe preview
          instead of leaking the original share card.
        </p>
        <div className="admin-policy-brief__rules">
          <span>
            <strong>Dismiss</strong> when no content or account change is needed.
          </span>
          <span>
            <strong>Mark actioned</strong> after removal, restore, note, status, or trust work.
          </span>
          <span>
            <strong>Stay proportionate</strong>: filters, notes, audit, and bulk tools are enough
            until real volume proves otherwise.
          </span>
        </div>
      </section>

      <div className="admin-workbench__main">
        <section className="hard-panel admin-queue" aria-labelledby="admin-reports-title">
          <div className="admin-panel-heading">
            <div>
              <p className="meta-label">Reports</p>
              <h2 id="admin-reports-title" className="admin-section-title">
                Review queue
              </h2>
              <p className="admin-panel-copy">
                {formatFilterSummary(filters)}{" "}
                Targets are public codes or usernames, not internal database ids.
              </p>
            </div>
            <span className="admin-count-chip">
              {reports.length} {reports.length === 1 ? "case" : "cases"}
            </span>
          </div>

          <div className="admin-filter-bar" aria-label="Report filters">
            <div className="admin-filter-bar__label">
              <Filter size={16} aria-hidden="true" />
              <span>Filter cases</span>
            </div>
            <label className="admin-filter">
              <span>Status</span>
              <select
                className="field-control"
                value={filters.status}
                aria-label="Filter reports by status"
                onChange={(event) =>
                  updateFilter("status", event.currentTarget.value as ReportFilters["status"])}
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            <label className="admin-filter">
              <span>Target</span>
              <select
                className="field-control"
                value={filters.targetType}
                aria-label="Filter reports by target type"
                onChange={(event) =>
                  updateFilter(
                    "targetType",
                    event.currentTarget.value as ReportFilters["targetType"],
                  )}
              >
                {TARGET_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            <label className="admin-filter">
              <span>Reason</span>
              <select
                className="field-control"
                value={filters.reason}
                aria-label="Filter reports by reason"
                onChange={(event) =>
                  updateFilter("reason", event.currentTarget.value as ReportFilters["reason"])}
              >
                <option value="all">All reasons</option>
                {REPORT_REASONS.map((reason) => (
                  <option key={reason} value={reason}>{humanReason(reason)}</option>
                ))}
              </select>
            </label>
          </div>

          {actionError && <p className="admin-error">{actionError}</p>}

          {visibleSelectedCount > 0 && (
            <div className="admin-bulk-bar" aria-label="Bulk report actions">
              <div>
                <p className="admin-bulk-bar__title">
                  {visibleSelectedCount} selected for batch review
                </p>
                <p className="admin-bulk-bar__hint">
                  Bulk actions change report status and can attach one shared note. Remove or
                  restore the target first when the content itself needs to change.
                </p>
                <textarea
                  className="field-control admin-bulk-bar__note"
                  value={bulkNote}
                  onChange={(event) =>
                    setBulkNote(event.currentTarget.value)}
                  placeholder="Optional note for selected targets"
                  aria-label="Optional note for selected targets"
                  rows={2}
                />
              </div>
              <div className="admin-bulk-bar__actions">
                <button
                  type="button"
                  className="tool-button"
                  onClick={() =>
                    runBulk("dismissed")}
                >
                  <CheckCircle2 size={16} aria-hidden="true" />
                  Dismiss
                </button>
                <button
                  type="button"
                  className="tool-button bg-signal text-pitch"
                  onClick={() => runBulk("actioned")}
                >
                  <ClipboardCheck size={16} aria-hidden="true" />
                  Mark actioned
                </button>
              </div>
            </div>
          )}

          {reports.length === 0
            ? (
              <div className="admin-empty">
                <ShieldCheck size={22} aria-hidden="true" />
                <p>No reports match these filters.</p>
                <span>
                  No safety work is visible here. Widen the status, target, or reason filter.
                </span>
              </div>
            )
            : (
              <div className="admin-report-list">
                {reports.map((report) => (
                  <ReportRow
                    key={report.id}
                    report={report}
                    selected={selectedIds.has(report.id)}
                    onToggleSelected={() => toggleReport(report.id)}
                    onAction={run}
                    onNote={addNote}
                    onUserStatus={updateUserStatus}
                    onUserTrustLevel={updateUserTrustLevel}
                  />
                ))}
              </div>
            )}
        </section>

        <AuditPanel
          events={auditEvents}
          loading={auditQuery.isPending}
          error={auditQuery.isError}
        />
      </div>

      <AdminDomainBlocksPanel
        blocks={domainBlocks}
        error={domainError}
        onCreate={createDomainBlock}
        onDelete={deleteDomainBlock}
      />
    </section>
  );
}

function AdminDomainBlocksPanel({
  blocks,
  error,
  onCreate,
  onDelete,
}: {
  blocks: AdminDomainBlock[];
  error: string | null;
  onCreate: (input: CreateDomainBlockInput) => Promise<void>;
  onDelete: (domain: string) => Promise<void>;
}) {
  const [domain, setDomain] = useState("");
  const [reason, setReason] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    const trimmedDomain = domain.trim().toLowerCase();
    if (!trimmedDomain) return;
    await onCreate({ domain: trimmedDomain, reason: reason.trim() || null });
    setDomain("");
    setReason("");
  }

  return (
    <section
      className="hard-panel admin-domain-blocks"
      aria-labelledby="admin-domain-blocks-title"
    >
      <div className="admin-panel-heading">
        <div>
          <p className="meta-label">Blocked domains</p>
          <h2 id="admin-domain-blocks-title" className="admin-section-title">
            Link policy
          </h2>
          <p className="admin-panel-copy">
            Block spammy or unsafe source domains from new external-image and YouTube posts.
            Existing canonical posts keep their normal moderation path.
          </p>
        </div>
        <span className="admin-count-chip">
          <Globe2 size={14} aria-hidden="true" />
          {blocks.length} blocked
        </span>
      </div>

      <form onSubmit={submit} className="admin-domain-form">
        <label className="admin-filter">
          <span>Domain</span>
          <input
            value={domain}
            onChange={(event) => setDomain(event.currentTarget.value)}
            placeholder="example.com"
            aria-label="Domain to block"
            className="field-control admin-mono-field"
            required
          />
        </label>
        <label className="admin-filter">
          <span>Reason</span>
          <input
            value={reason}
            onChange={(event) => setReason(event.currentTarget.value)}
            placeholder="Spam source"
            aria-label="Reason for blocking domain"
            className="field-control"
          />
        </label>
        <button type="submit" className="tool-button bg-signal text-pitch">
          <Plus size={16} aria-hidden="true" />
          Block domain
        </button>
      </form>

      {error && <p className="admin-error">{error}</p>}

      {blocks.length === 0
        ? (
          <p className="admin-empty admin-empty--inline">
            No domains are blocked. New media links still use URL validation and provider checks.
          </p>
        )
        : (
          <div className="admin-domain-list">
            {blocks.map((block) => (
              <article key={block.id} className="admin-domain-row">
                <div>
                  <p className="admin-domain-row__domain">{block.domain}</p>
                  <p className="admin-domain-row__meta">
                    {block.reason || "No reason recorded."} Added by @{block.createdBy.username}
                    {" "}
                    {formatDate(block.createdAt)}
                  </p>
                </div>
                <button
                  type="button"
                  className="tool-button admin-danger-button"
                  onClick={() => onDelete(block.domain)}
                >
                  <Trash2 size={16} aria-hidden="true" />
                  Unblock
                </button>
              </article>
            ))}
          </div>
        )}
    </section>
  );
}

function ReportRow({
  report,
  selected,
  onToggleSelected,
  onAction,
  onNote,
  onUserStatus,
  onUserTrustLevel,
}: {
  report: Report;
  selected: boolean;
  onToggleSelected: () => void;
  onAction: (path: string, body?: unknown) => void;
  onNote: (report: Report, bodyText: string) => Promise<void>;
  onUserStatus: (report: Report, status: UserStatus) => Promise<void>;
  onUserTrustLevel: (report: Report, trustLevel: UserTrustLevel) => Promise<void>;
}) {
  const [noteDraft, setNoteDraft] = useState("");
  const code = report.targetCode;
  const reportOpen = report.status === "open";

  async function submitNote(event: FormEvent) {
    event.preventDefault();
    const bodyText = noteDraft.trim();
    if (!bodyText) return;
    await onNote(report, bodyText);
    setNoteDraft("");
  }

  return (
    <article className={`admin-report-row ${selected ? "admin-report-row--selected" : ""}`}>
      <label className="admin-report-row__select">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelected}
          aria-label={`Select report for ${report.targetType} ${code}`}
        />
        <span aria-hidden="true" />
      </label>

      <div className="admin-report-row__body">
        <div className="admin-report-row__head">
          <div className="admin-report-row__target">
            <span className="admin-type-chip">{report.targetType}</span>
            <strong>{code}</strong>
            <span className={`admin-status-chip admin-status-chip--${report.status}`}>
              {report.status}
            </span>
            <span className="admin-reason-pill">{humanReason(report.reason)}</span>
            <span className={reviewPriorityChipClass(report.reviewPriority)}>
              P{report.reviewPriority} {reviewPriorityLabel(report.reviewPriority)}
            </span>
          </div>
          <p className="meta-label">
            Reported by @{report.reporter.username} ({report.reporterTrustLevel}) at{" "}
            {formatDate(report.createdAt)}
          </p>
        </div>

        <div className="admin-report-row__evidence">
          <span>Reporter detail</span>
          <p>{report.details?.trim() || "No reporter details."}</p>
        </div>

        {report.notes.length > 0 && (
          <div className="admin-note-list" aria-label="Moderator notes">
            {report.notes.map((note) => (
              <div key={note.id} className="admin-note">
                <StickyNote size={14} aria-hidden="true" />
                <p>
                  <strong>@{note.author.username}</strong> {note.bodyText}
                  <span>{formatDate(note.createdAt)}</span>
                </p>
              </div>
            ))}
          </div>
        )}

        <form className="admin-note-form" onSubmit={submitNote}>
          <textarea
            className="field-control"
            value={noteDraft}
            onChange={(event) => setNoteDraft(event.currentTarget.value)}
            placeholder="Add moderator note"
            aria-label={`Add moderator note for ${report.targetType} ${code}`}
            rows={2}
          />
          <button type="submit" className="tool-button" disabled={!noteDraft.trim()}>
            <StickyNote size={16} aria-hidden="true" />
            Add note
          </button>
        </form>

        {report.targetType === "user" && (
          <div className="admin-user-status" aria-label={`User controls for ${code}`}>
            <p className="admin-user-status__copy">
              Status changes affect whether this account can keep writing. Trust level is internal
              for limits, report weight, and review priority; it is not public karma.
            </p>
            <div className="admin-user-status__row">
              <span>
                Account status: <strong>{report.targetUserStatus ?? "unknown"}</strong>
              </span>
              <div className="admin-user-status__actions">
                {USER_STATUS_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={option.value === "banned"
                      ? "tool-button admin-danger-button"
                      : "tool-button"}
                    disabled={report.targetUserStatus === option.value}
                    onClick={() => onUserStatus(report, option.value)}
                  >
                    {option.value === "banned"
                      ? <Ban size={16} aria-hidden="true" />
                      : option.value === "active"
                      ? <ShieldCheck size={16} aria-hidden="true" />
                      : <ShieldAlert size={16} aria-hidden="true" />}
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="admin-user-status__row">
              <span>
                Trust level: <strong>{report.targetUserTrustLevel ?? "unknown"}</strong>
              </span>
              <div className="admin-user-status__actions">
                {USER_TRUST_LEVEL_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={trustLevelButtonClass(option.value)}
                    disabled={report.targetUserTrustLevel === option.value}
                    onClick={() => onUserTrustLevel(report, option.value)}
                  >
                    {trustLevelIcon(option.value)}
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        <div
          className="admin-report-actions"
          aria-label={`Actions for ${report.targetType} ${code}`}
        >
          {report.targetType === "post" && (
            <>
              <button
                type="button"
                className="tool-button admin-danger-button"
                onClick={() => onAction(`posts/${code}/remove`)}
              >
                <Trash2 size={16} aria-hidden="true" />
                Remove post
              </button>
              <button
                type="button"
                className="tool-button"
                onClick={() => onAction(`posts/${code}/restore`)}
              >
                <RotateCcw size={16} aria-hidden="true" />
                Restore post
              </button>
            </>
          )}
          {report.targetType === "comment" && (
            <>
              <button
                type="button"
                className="tool-button admin-danger-button"
                onClick={() => onAction(`comments/${code}/remove`)}
              >
                <Trash2 size={16} aria-hidden="true" />
                Remove comment
              </button>
              <button
                type="button"
                className="tool-button"
                onClick={() => onAction(`comments/${code}/restore`)}
              >
                <RotateCcw size={16} aria-hidden="true" />
                Restore comment
              </button>
            </>
          )}
          <button
            type="button"
            className="tool-button"
            disabled={!reportOpen}
            onClick={() => onAction(`reports/${report.id}/dismiss`)}
          >
            <CheckCircle2 size={16} aria-hidden="true" />
            Dismiss
          </button>
          <button
            type="button"
            className="tool-button bg-signal text-pitch"
            disabled={!reportOpen}
            onClick={() => onAction(`reports/${report.id}/action`)}
          >
            <ClipboardCheck size={16} aria-hidden="true" />
            Mark actioned
          </button>
        </div>
      </div>
    </article>
  );
}

function AuditPanel({
  events,
  loading,
  error,
}: {
  events: ModerationAuditEvent[];
  loading: boolean;
  error: boolean;
}) {
  return (
    <section className="hard-panel admin-audit" aria-labelledby="admin-audit-title">
      <div className="admin-panel-heading">
        <div>
          <p className="meta-label">History</p>
          <h2 id="admin-audit-title" className="admin-section-title">Audit log</h2>
          <p className="admin-panel-copy">
            {events.length === 0
              ? "Notes, removals, restores, report outcomes, and user changes will appear here."
              : `${events.length} recent actions across notes, removals, restores, reports, and users.`}
          </p>
        </div>
        <History size={18} aria-hidden="true" />
      </div>

      {loading
        ? <p className="admin-empty admin-empty--inline">Loading audit history.</p>
        : error
        ? <p className="admin-error">Could not load audit history.</p>
        : events.length === 0
        ? <p className="admin-empty admin-empty--inline">No moderation history yet.</p>
        : (
          <div className="admin-audit-list">
            {events.map((event) => (
              <div key={event.id} className="admin-audit-event">
                <span className="admin-type-chip">{event.targetType}</span>
                <p>
                  <strong>{labelAuditAction(event.action)}</strong> {event.targetCode}
                  <span>by @{event.actor.username} - {formatDate(event.createdAt)}</span>
                </p>
              </div>
            ))}
          </div>
        )}
    </section>
  );
}

function humanReason(reason: string): string {
  return reason.replace(/_/g, " ");
}

function formatDate(value: string): string {
  return dateFormatter.format(new Date(value));
}

function labelAuditAction(action: ModerationAuditEvent["action"]): string {
  return action.replace(/_/g, " ");
}

function formatFilterSummary(filters: ReportFilters): string {
  const status = filters.status === "all" ? "every status" : `${filters.status} reports`;
  const target = filters.targetType === "all" ? "all targets" : `${filters.targetType} targets`;
  const reason = filters.reason === "all" ? "all reasons" : humanReason(filters.reason);
  return `Showing ${status} across ${target} for ${reason}.`;
}

function reviewPriorityLabel(priority: number): string {
  if (priority >= 50) return "staff";
  if (priority >= 40) return "trusted";
  if (priority <= 10) return "low";
  return "standard";
}

function reviewPriorityChipClass(priority: number): string {
  if (priority >= 40) return "admin-priority-chip admin-priority-chip--high";
  if (priority <= 10) return "admin-priority-chip admin-priority-chip--low";
  return "admin-priority-chip";
}

function trustLevelButtonClass(trustLevel: UserTrustLevel): string {
  if (trustLevel === "limited") return "tool-button admin-danger-button";
  if (trustLevel === "admin") return "tool-button bg-signal";
  return "tool-button";
}

function trustLevelIcon(trustLevel: UserTrustLevel) {
  if (trustLevel === "limited") return <ShieldAlert size={16} aria-hidden="true" />;
  if (trustLevel === "admin" || trustLevel === "trusted" || trustLevel === "moderator") {
    return <ShieldCheck size={16} aria-hidden="true" />;
  }
  return <ClipboardCheck size={16} aria-hidden="true" />;
}

function Shell({ message }: { message: string }) {
  return (
    <div className="hard-panel admin-shell-state">
      <ShieldAlert size={22} aria-hidden="true" />
      <p>{message}</p>
    </div>
  );
}
