import type { Report } from "@doomscrollr/shared/types.ts";

export function countOpenReports(reports: Report[]) {
  return reports.filter((report) => report.status === "open").length;
}
