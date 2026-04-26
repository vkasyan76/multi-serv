import test from "node:test";
import assert from "node:assert/strict";
import { canShowSelfCancelAction } from "../ui/orders-lifecycle-shared";

const nowMs = Date.parse("2026-05-01T10:00:00.000Z");

function row(overrides: Partial<Parameters<typeof canShowSelfCancelAction>[0]>) {
  return {
    lifecycleMode: "slot",
    status: "pending",
    serviceStatus: "scheduled",
    invoiceStatus: "none",
    slots: [
      {
        id: "slot-1",
        start: "2026-05-03T10:00:00.000Z",
        end: "2026-05-03T11:00:00.000Z",
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
        start: "2026-05-03T10:00:00.000Z",
        end: "2026-05-03T11:00:00.000Z",
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
            start: "2026-05-02T09:00:00.000Z",
            end: "2026-05-02T10:00:00.000Z",
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
