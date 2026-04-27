import test from "node:test";
import assert from "node:assert/strict";
import { CANCELLATION_WINDOW_HOURS } from "@/constants";
import { canShowSelfCancelAction } from "../ui/orders-lifecycle-shared";

const nowMs = Date.parse("2026-05-01T10:00:00.000Z");
const HOUR_MS = 60 * 60 * 1000;
const outsideCutoffStart = new Date(
  nowMs + (CANCELLATION_WINDOW_HOURS + 24) * HOUR_MS,
).toISOString();
const outsideCutoffEnd = new Date(
  nowMs + (CANCELLATION_WINDOW_HOURS + 25) * HOUR_MS,
).toISOString();
const withinCutoffStart = new Date(
  nowMs + Math.max(CANCELLATION_WINDOW_HOURS - 1, 0) * HOUR_MS,
).toISOString();
const withinCutoffEnd = new Date(
  nowMs + Math.max(CANCELLATION_WINDOW_HOURS, 1) * HOUR_MS,
).toISOString();

function row(overrides: Partial<Parameters<typeof canShowSelfCancelAction>[0]>) {
  return {
    lifecycleMode: "slot",
    status: "pending",
    serviceStatus: "scheduled",
    invoiceStatus: "none",
    slots: [
      {
        id: "slot-1",
        start: outsideCutoffStart,
        end: outsideCutoffEnd,
        serviceStatus: "scheduled",
        disputeReason: null,
        serviceSnapshot: null,
      },
    ],
    ...overrides,
  } as Parameters<typeof canShowSelfCancelAction>[0];
}

test("requested order cancel action is opt-in for customer UI", () => {
  const requested = row({
    serviceStatus: "requested",
    slots: [
      {
        id: "slot-1",
        start: outsideCutoffStart,
        end: outsideCutoffEnd,
        serviceStatus: "requested",
        disputeReason: null,
        serviceSnapshot: null,
      },
    ],
  });

  assert.equal(canShowSelfCancelAction(requested, nowMs), false);
  assert.equal(
    canShowSelfCancelAction(requested, nowMs, { allowRequested: true }),
    true,
  );
});

test("scheduled order cancel action still obeys invoice and cutoff rules", () => {
  assert.equal(canShowSelfCancelAction(row({}), nowMs), true);
  assert.equal(
    canShowSelfCancelAction(
      row({
        slots: [
          {
            id: "slot-1",
            start: withinCutoffStart,
            end: withinCutoffEnd,
            serviceStatus: "scheduled",
            disputeReason: null,
            serviceSnapshot: null,
          },
        ],
      }),
      nowMs,
    ),
    false,
  );
  assert.equal(canShowSelfCancelAction(row({ invoiceStatus: "issued" }), nowMs), false);
});

test("canceled requested order does not show cancel action", () => {
  assert.equal(
    canShowSelfCancelAction(
      row({
        status: "canceled",
        serviceStatus: "requested",
      }),
      nowMs,
      { allowRequested: true },
    ),
    false,
  );
});
