import test from "node:test";
import assert from "node:assert/strict";
import { formatInTimeZone } from "date-fns-tz";

import {
  adminWalletRowsToCsv,
  deriveInvoiceRangeIso,
} from "../ui/wallet-filter-utils";
import type { WalletTransactionRow } from "../ui/wallet-types";

test("deriveInvoiceRangeIso range mode keeps end date exclusive in Berlin", () => {
  const sameDay = new Date("2026-02-21T12:00:00.000Z");
  const { startIso, endIso } = deriveInvoiceRangeIso({
    mode: "range",
    start: sameDay,
    end: sameDay,
  });

  assert.ok(startIso);
  assert.ok(endIso);
  assert.equal(
    formatInTimeZone(startIso!, "Europe/Berlin", "yyyy-MM-dd HH:mm"),
    "2026-02-21 00:00",
  );
  assert.equal(
    formatInTimeZone(endIso!, "Europe/Berlin", "yyyy-MM-dd HH:mm"),
    "2026-02-22 00:00",
  );
});

test("deriveInvoiceRangeIso month/year period boundaries stay Berlin-normalized", () => {
  const month = deriveInvoiceRangeIso({ mode: "month", year: 2026, month: 3 });
  assert.equal(
    formatInTimeZone(month.startIso!, "Europe/Berlin", "yyyy-MM-dd HH:mm"),
    "2026-03-01 00:00",
  );
  assert.equal(
    formatInTimeZone(month.endIso!, "Europe/Berlin", "yyyy-MM-dd HH:mm"),
    "2026-04-01 00:00",
  );

  const year = deriveInvoiceRangeIso({ mode: "year", year: 2026 });
  assert.equal(
    formatInTimeZone(year.startIso!, "Europe/Berlin", "yyyy-MM-dd HH:mm"),
    "2026-01-01 00:00",
  );
  assert.equal(
    formatInTimeZone(year.endIso!, "Europe/Berlin", "yyyy-MM-dd HH:mm"),
    "2027-01-01 00:00",
  );
});

test("adminWalletRowsToCsv includes Berlin-local occurred_at and timezone columns", () => {
  const rows: WalletTransactionRow[] = [
    {
      id: "row_1",
      type: "payment_received",
      occurredAt: "2026-02-21T13:00:00.000Z",
      description: "Paid",
      amountCents: 1000,
      currency: "eur",
      invoiceId: "inv_1",
    },
  ];

  const csv = adminWalletRowsToCsv(rows, {
    appLang: "en",
    timezone: "Europe/Berlin",
  });
  const [header = "", line = ""] = csv.split("\n");

  assert.ok(header.includes("occurred_at_berlin"));
  assert.ok(header.includes("timezone"));
  assert.ok(line.includes("Europe/Berlin"));
});
