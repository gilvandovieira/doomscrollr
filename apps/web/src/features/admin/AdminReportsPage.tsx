import { REPORT_REASONS } from "@doomscrollr/shared/constants.ts";
import type {
  AdminReportListQuery,
  AdminTag,
  CreateAdminTagInput,
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
import {
  adminAction,
  ApiError,
  bulkReportAction,
  createAdminTag,
  createModerationNote,
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
  const [tagError, setTagError] = useState<string | null>(null);

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
  const tagsQuery = useQuery({
    queryKey: ["admin-tags"],
    queryFn: () => fetchAdminTags(getToken),
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

  async function refreshTags() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["admin-tags"] }),
      queryClient.invalidateQueries({ queryKey: ["tags"] }),
    ]);
  }

  async function runTagAction(path: string, body?: unknown) {
    setTagError(null);
    try {
      await adminAction(path, getToken, body);
      await refreshTags();
    } catch (err) {
      setTagError(err instanceof ApiError ? err.message : "Tag action failed.");
    }
  }

  async function createTag(input: CreateAdminTagInput) {
    setTagError(null);
    try {
      await createAdminTag(input, getToken);
      await refreshTags();
    } catch (err) {
      setTagError(err instanceof ApiError ? err.message : "Could not create tag.");
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

  if (!signedIn) return <Shell message="Sign in as an admin to view reports." />;
  if (reportsQuery.isPending || tagsQuery.isPending) return <Shell message="Loading admin." />;
  if (reportsQuery.isError || tagsQuery.isError) {
    const error = reportsQuery.error ?? tagsQuery.error;
    const message = error instanceof ApiError && error.status === 403
      ? "Admin access required."
      : "Could not load admin data.";
    return <Shell message={message} />;
  }

  const reports = reportsQuery.data;
  const tags = tagsQuery.data;
  const visibleSelectedCount = reports.filter((report) => selectedIds.has(report.id)).length;
  const openCount = reports.filter((report) => report.status === "open").length;
  const actionedCount = reports.filter((report) => report.status === "actioned").length;
  const userCaseCount = reports.filter((report) => report.targetType === "user").length;
  const activeTagCount = tags.filter((tag) => tag.status === "active").length;
  const auditEvents = auditQuery.data ?? [];

  return (
    <section className="admin-workbench">
      <header className="admin-workbench__masthead">
        <div className="admin-workbench__identity">
          <p className="meta-label">Moderator console</p>
          <h1 className="mobile-title admin-workbench__title">Admin docket</h1>
          <p className="admin-workbench__summary">
            Work the visible report queue, leave target notes, and keep restore decisions easy to
            trace.
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

      <div className="admin-workbench__main">
        <section className="hard-panel admin-queue" aria-labelledby="admin-reports-title">
          <div className="admin-panel-heading">
            <div>
              <p className="meta-label">Reports</p>
              <h2 id="admin-reports-title" className="admin-section-title">
                Review queue
              </h2>
              <p className="admin-panel-copy">{formatFilterSummary(filters)}</p>
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
                  Add one note before resolving every selected visible case.
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
                <span>Try widening the status, target, or reason filter.</span>
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

      <AdminTagsPanel
        tags={tags}
        activeCount={activeTagCount}
        error={tagError}
        onCreate={createTag}
        onAction={runTagAction}
      />
    </section>
  );
}

function AdminTagsPanel({
  tags,
  activeCount,
  error,
  onCreate,
  onAction,
}: {
  tags: AdminTag[];
  activeCount: number;
  error: string | null;
  onCreate: (input: CreateAdminTagInput) => Promise<void>;
  onAction: (path: string, body?: unknown) => Promise<void>;
}) {
  const [form, setForm] = useState<CreateAdminTagInput>({
    slug: "",
    displayName: "",
    description: null,
  });
  const [aliasDrafts, setAliasDrafts] = useState<Record<string, string>>({});
  const [mergeDrafts, setMergeDrafts] = useState<Record<string, string>>({});

  async function submit(event: FormEvent) {
    event.preventDefault();
    await onCreate({
      slug: form.slug.trim().toLowerCase(),
      displayName: form.displayName.trim(),
      description: form.description?.trim() || null,
    });
    setForm({ slug: "", displayName: "", description: null });
  }

  async function addAlias(tag: AdminTag) {
    const aliasSlug = aliasDrafts[tag.slug]?.trim().toLowerCase();
    if (!aliasSlug) return;
    await onAction(`tags/${tag.slug}/aliases`, { aliasSlug });
    setAliasDrafts((current) => ({ ...current, [tag.slug]: "" }));
  }

  async function mergeInto(tag: AdminTag) {
    const targetSlug = mergeDrafts[tag.slug]?.trim().toLowerCase();
    if (!targetSlug) return;
    await onAction(`tags/${tag.slug}/merge`, { targetSlug });
    setMergeDrafts((current) => ({ ...current, [tag.slug]: "" }));
  }

  return (
    <section className="hard-panel admin-tags" aria-labelledby="admin-tags-title">
      <div className="admin-panel-heading">
        <div>
          <p className="meta-label">Curated tags</p>
          <h2 id="admin-tags-title" className="admin-section-title">Tag controls</h2>
          <p className="admin-panel-copy">
            Canonicalize meme labels before they fragment the feed.
          </p>
        </div>
        <span className="admin-count-chip">
          <Tags size={14} aria-hidden="true" />
          {activeCount}/{tags.length} active
        </span>
      </div>

      <form onSubmit={submit} className="admin-tag-form">
        <label className="admin-filter">
          <span>Slug</span>
          <input
            value={form.slug}
            onChange={(event) => setForm((current) => ({ ...current, slug: event.target.value }))}
            placeholder="wholesome-chaos"
            className="field-control admin-mono-field"
            required
          />
        </label>
        <label className="admin-filter">
          <span>Display name</span>
          <input
            value={form.displayName}
            onChange={(event) =>
              setForm((current) => ({ ...current, displayName: event.target.value }))}
            placeholder="Wholesome chaos"
            className="field-control"
            required
          />
        </label>
        <label className="admin-filter">
          <span>Description</span>
          <input
            value={form.description ?? ""}
            onChange={(event) =>
              setForm((current) => ({ ...current, description: event.target.value }))}
            placeholder="Short curator note"
            className="field-control"
          />
        </label>
        <button type="submit" className="tool-button bg-signal text-pitch">
          <Plus size={16} aria-hidden="true" />
          Create tag
        </button>
      </form>

      {error && <p className="admin-error">{error}</p>}

      <div className="admin-tag-grid">
        {tags.map((tag) => (
          <article key={tag.slug} className={`admin-tag-row admin-tag-row--${tag.status}`}>
            <div className="admin-tag-row__head">
              <div>
                <p className="admin-tag-row__slug">#{tag.slug}</p>
                <p className="admin-tag-row__name">{tag.displayName}</p>
                <div className="admin-tag-row__meta">
                  <span>{tag.status}</span>
                  <span>{tag.postCount} {tag.postCount === 1 ? "post" : "posts"}</span>
                </div>
                {tag.aliases.length > 0 && (
                  <p className="admin-tag-row__aliases">
                    aliases: {tag.aliases.map((alias) => `#${alias}`).join(", ")}
                  </p>
                )}
              </div>
              <button
                type="button"
                className="tool-button"
                onClick={() =>
                  onAction(`tags/${tag.slug}/${tag.status === "active" ? "disable" : "enable"}`)}
              >
                <Power size={16} aria-hidden="true" />
                {tag.status === "active" ? "Disable" : "Enable"}
              </button>
            </div>

            <div className="admin-tag-row__tools">
              <input
                value={aliasDrafts[tag.slug] ?? ""}
                onChange={(event) =>
                  setAliasDrafts((current) => ({ ...current, [tag.slug]: event.target.value }))}
                placeholder="alias slug"
                aria-label={`Alias slug for ${tag.displayName}`}
                className="field-control admin-mono-field"
              />
              <button
                type="button"
                className="tool-button"
                onClick={() =>
                  addAlias(tag)}
              >
                <Plus size={16} aria-hidden="true" />
                Add alias
              </button>
              <input
                value={mergeDrafts[tag.slug] ?? ""}
                onChange={(event) =>
                  setMergeDrafts((current) => ({ ...current, [tag.slug]: event.target.value }))}
                placeholder="merge into slug"
                aria-label={`Merge ${tag.displayName} into tag slug`}
                className="field-control admin-mono-field"
              />
              <button
                type="button"
                className="tool-button"
                onClick={() =>
                  mergeInto(tag)}
              >
                <GitMerge size={16} aria-hidden="true" />
                Merge
              </button>
            </div>
          </article>
        ))}
      </div>
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
          </div>
          <p className="meta-label">
            Reported by @{report.reporter.username} at {formatDate(report.createdAt)}
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
              ? "Latest actions will appear here."
              : `${events.length} recent actions`}
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
