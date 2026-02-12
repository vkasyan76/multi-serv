import { fromZonedTime } from "date-fns-tz";

const BERLIN_TZ = "Europe/Berlin";

export function getBerlinMonthRange(year: number, month: number) {
  // month is 1-12; we convert Berlin local boundaries to UTC instants.
  const mm = String(month).padStart(2, "0");
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const mmNext = String(nextMonth).padStart(2, "0");

  const periodStart = fromZonedTime(`${year}-${mm}-01T00:00:00`, BERLIN_TZ);
  const periodEnd = fromZonedTime(
    `${nextYear}-${mmNext}-01T00:00:00`,
    BERLIN_TZ,
  );

  return { periodStart, periodEnd };
}

export function buildStatementNumber(
  year: number,
  month: number,
  tenantSlug: string,
) {
  const mm = String(month).padStart(2, "0");
  return `CS-${year}-${mm}-${tenantSlug}`;
}
