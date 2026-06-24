import type { ModerationAuditEvent } from "@doomscrollr/shared/types.ts";
import type { TFunction } from "i18next";
import { useQuery } from "@tanstack/react-query";
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { ChevronLeft, ChevronRight, History } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useAuthToken, useIsSignedIn } from "../../app/account.ts";
import { ApiError, fetchModerationAudit } from "../../app/api.ts";
import { getLocale } from "../../app/i18n.ts";
import { AdminShell, AdminTabs } from "./admin-nav.tsx";

const PAGE_SIZE = 20;

const DATE_TIME_OPTIONS: Intl.DateTimeFormatOptions = {
  dateStyle: "medium",
  timeStyle: "short",
};

export function AdminHistoryPage() {
  const { t } = useTranslation();
  const signedIn = useIsSignedIn();

  const historyColumns = useMemo<Array<ColumnDef<ModerationAuditEvent>>>(() => [
    {
      accessorKey: "createdAt",
      header: t("admin.historyPage.colTime"),
      cell: ({ row }) => (
        <time dateTime={row.original.createdAt}>{formatDateTime(row.original.createdAt)}</time>
      ),
    },
    {
      accessorKey: "action",
      header: t("admin.historyPage.colAction"),
      cell: ({ row }) => <strong>{labelAuditAction(row.original.action, t)}</strong>,
    },
    {
      id: "target",
      header: t("admin.historyPage.colTarget"),
      cell: ({ row }) => (
        <span className="admin-history-target">
          <span className="admin-type-chip">{row.original.targetType}</span>
          <code>{formatTargetCode(row.original)}</code>
        </span>
      ),
    },
    {
      id: "actor",
      header: t("admin.historyPage.colActor"),
      cell: ({ row }) => `@${row.original.actor.username}`,
    },
    {
      id: "details",
      header: t("admin.historyPage.colDetails"),
      cell: ({ row }) => formatAuditDetails(row.original),
    },
  ], [t]);
  const getToken = useAuthToken();

  const auditQuery = useQuery({
    queryKey: ["moderation-audit", "all"],
    queryFn: () => fetchModerationAudit(getToken, { limit: "all" }),
    enabled: signedIn,
    retry: false,
  });

  const events = auditQuery.data ?? [];
  const table = useReactTable({
    data: events,
    columns: historyColumns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: {
        pageSize: PAGE_SIZE,
      },
    },
  });
  const pagination = table.getState().pagination;
  const pageCount = Math.max(1, table.getPageCount());
  const currentPage = Math.min(pagination.pageIndex + 1, pageCount);
  const visibleRows = table.getRowModel().rows;
  const firstVisible = events.length === 0 ? 0 : pagination.pageIndex * pagination.pageSize + 1;
  const lastVisible = visibleRows.length === 0
    ? 0
    : Math.min(firstVisible + visibleRows.length - 1, events.length);

  if (!signedIn) {
    return (
      <section className="admin-workbench">
        <AdminTabs active="history" />
        <AdminShell message={t("admin.shell.signIn")} />
      </section>
    );
  }

  if (auditQuery.isPending) {
    return (
      <section className="admin-workbench">
        <AdminTabs active="history" />
        <AdminShell message={t("admin.shell.loadingHistory")} />
      </section>
    );
  }

  if (auditQuery.isError) {
    const message = auditQuery.error instanceof ApiError && auditQuery.error.status === 403
      ? t("admin.shell.accessRequired")
      : t("admin.shell.loadHistoryError");
    return (
      <section className="admin-workbench">
        <AdminTabs active="history" />
        <AdminShell message={message} />
      </section>
    );
  }

  return (
    <section className="admin-workbench">
      <AdminTabs active="history" />

      <header className="admin-workbench__masthead">
        <div className="admin-workbench__identity">
          <p className="meta-label">{t("admin.historyPage.eyebrow")}</p>
          <h1 className="mobile-title admin-workbench__title">{t("admin.historyPage.title")}</h1>
          <p className="admin-workbench__summary">{t("admin.historyPage.summary")}</p>
        </div>
        <dl className="admin-case-tape" aria-label="History table summary">
          <div className="admin-case-tape__item admin-case-tape__item--open">
            <dt>{t("admin.historyPage.tape.events")}</dt>
            <dd>{events.length}</dd>
          </div>
          <div className="admin-case-tape__item">
            <dt>{t("admin.historyPage.tape.page")}</dt>
            <dd>{currentPage}</dd>
          </div>
          <div className="admin-case-tape__item">
            <dt>{t("admin.historyPage.tape.rowsShown")}</dt>
            <dd>{visibleRows.length}</dd>
          </div>
          <div className="admin-case-tape__item">
            <dt>{t("admin.historyPage.tape.pageSize")}</dt>
            <dd>{PAGE_SIZE}</dd>
          </div>
        </dl>
      </header>

      <section className="hard-panel admin-history-panel" aria-labelledby="admin-history-title">
        <div className="admin-panel-heading">
          <div>
            <p className="meta-label">{t("admin.historyPage.tableEyebrow")}</p>
            <h2 id="admin-history-title" className="admin-section-title">
              {t("admin.historyPage.tableTitle")}
            </h2>
            <p className="admin-panel-copy">
              {t("admin.historyPage.showing", {
                from: firstVisible,
                to: lastVisible,
                total: events.length,
              })}
            </p>
          </div>
          <span className="admin-count-chip">
            <History size={14} aria-hidden="true" />
            {t("admin.historyPage.pages", { count: pageCount })}
          </span>
        </div>

        <div className="admin-table-scroll">
          <table className="admin-history-table">
            <thead>
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th key={header.id} scope="col" colSpan={header.colSpan}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {visibleRows.length === 0
                ? (
                  <tr>
                    <td colSpan={table.getAllLeafColumns().length}>
                      <p className="admin-history-table__empty">
                        {t("admin.historyPage.empty")}
                      </p>
                    </td>
                  </tr>
                )
                : visibleRows.map((row) => (
                  <tr key={row.id}>
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        <div className="admin-pagination" aria-label="History pages">
          <p>{t("admin.historyPage.pageOf", { current: currentPage, total: pageCount })}</p>
          <div className="admin-pagination__actions">
            <button
              type="button"
              className="tool-button"
              disabled={!table.getCanPreviousPage()}
              onClick={() => table.previousPage()}
            >
              <ChevronLeft size={16} aria-hidden="true" />
              {t("admin.historyPage.prev")}
            </button>
            <button
              type="button"
              className="tool-button"
              disabled={!table.getCanNextPage()}
              onClick={() => table.nextPage()}
            >
              {t("admin.historyPage.next")}
              <ChevronRight size={16} aria-hidden="true" />
            </button>
          </div>
        </div>
      </section>
    </section>
  );
}

function formatDateTime(value: string): string {
  // Follow the app's chosen display language, not the browser locale.
  return new Intl.DateTimeFormat(getLocale(), DATE_TIME_OPTIONS).format(new Date(value));
}

function labelAuditAction(action: ModerationAuditEvent["action"], t: TFunction): string {
  return t(`enum.auditAction.${action}`);
}

function humanValue(value: string): string {
  return value.replace(/_/g, " ");
}

function formatTargetCode(event: ModerationAuditEvent): string {
  return event.targetType === "user" ? `@${event.targetCode}` : event.targetCode;
}

function formatAuditDetails(event: ModerationAuditEvent): string {
  const details: string[] = [];
  if (event.reason) details.push(humanValue(event.reason));
  if (event.metadata.bulk === true) details.push("Bulk action");

  const previousStatus = stringMetadata(event, "previousStatus");
  const status = stringMetadata(event, "status");
  if (previousStatus && status) {
    details.push(`${humanValue(previousStatus)} to ${humanValue(status)}`);
  }

  const previousTrustLevel = stringMetadata(event, "previousTrustLevel");
  const trustLevel = stringMetadata(event, "trustLevel");
  if (previousTrustLevel && trustLevel) {
    details.push(`${humanValue(previousTrustLevel)} to ${humanValue(trustLevel)}`);
  }

  return details.length > 0 ? details.join(" | ") : "No details";
}

function stringMetadata(event: ModerationAuditEvent, key: string): string | null {
  const value = event.metadata[key];
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}
