/**
 * Whether a diagram element should appear in BOMs, schedules, and other
 * procurement / reporting outputs. Omitted or `true` = included (default);
 * explicit `false` = excluded from reports but still drawn on the canvas.
 */
export function includeInReports(
  data: { includeInReports?: boolean } | null | undefined,
): boolean {
  return data?.includeInReports !== false;
}
