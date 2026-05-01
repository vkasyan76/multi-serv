import test from "node:test";
import assert from "node:assert/strict";

import { createSupportTopicContext } from "@/modules/support-chat/server/topics";
import { detectTopicAccountEscalation } from "@/modules/support-chat/server/topic-account-escalation";

test("cancellation context escalates scheduled follow-ups only with personal booking intent", () => {
  const context = createSupportTopicContext({
    topic: "cancellation",
    source: "starter_prompt",
  });

  assert.equal(
    detectTopicAccountEscalation({ message: "already scheduled", context }),
    null
  );
  assert.equal(
    detectTopicAccountEscalation({ message: "schon geplant", context }),
    null
  );
  assert.deepEqual(
    detectTopicAccountEscalation({
      message: "my already scheduled booking",
      context,
    }),
    {
      statusFilter: "scheduled",
      selectionHelper: "canCancelOrderForCurrentUser",
    }
  );
  assert.deepEqual(
    detectTopicAccountEscalation({
      message: "meine geplante Buchung",
      context,
    }),
    {
      statusFilter: "scheduled",
      selectionHelper: "canCancelOrderForCurrentUser",
    }
  );
});

test("cancellation context escalates explicit personal cancellation lookups without status filter", () => {
  const context = createSupportTopicContext({
    topic: "cancellation",
    source: "starter_prompt",
  });

  for (const message of [
    "Do I have bookings I can cancel?",
    "Which bookings can I cancel?",
    "Gibt es bei mir noch Buchungen die ich stornieren kann?",
    "Habe ich Buchungen, die ich stornieren kann?",
    "Welche Buchungen kann ich stornieren?",
    "Quelles réservations puis-je annuler ?",
    "Quelles commandes puis-je annuler ?",
    "Qué reservas puedo cancelar?",
    "Quali prenotazioni posso annullare?",
    "Quais reservas posso cancelar?",
    "Które rezerwacje mogę anulować?",
    "Ce rezervări pot anula?",
    "Які бронювання можна скасувати?",
  ]) {
    assert.deepEqual(
      detectTopicAccountEscalation({ message, context }),
      {
        selectionHelper: "canCancelOrderForCurrentUser",
      },
      message
    );
  }
});

test("cancellation context keeps general help questions non-account", () => {
  const context = createSupportTopicContext({
    topic: "cancellation",
    source: "starter_prompt",
  });

  for (const message of [
    "Wie funktioniert Stornierung?",
    "Kann man eine Buchung stornieren?",
    "Was passiert bei einer Stornierung?",
  ]) {
    assert.equal(detectTopicAccountEscalation({ message, context }), null, message);
  }
});

test("cancellation context escalates requested and canceled personal follow-ups", () => {
  const context = createSupportTopicContext({
    topic: "cancellation",
    source: "starter_prompt",
  });

  for (const message of [
    "my requested booking",
    "my booking awaiting confirmation",
  ]) {
    assert.deepEqual(
      detectTopicAccountEscalation({
        message,
        context,
      }),
      {
        statusFilter: "requested",
        selectionHelper: "canCancelOrderForCurrentUser",
      },
      message
    );
  }

  for (const message of ["my canceled booking", "my canceled order"]) {
    assert.deepEqual(
      detectTopicAccountEscalation({ message, context }),
      {
        statusFilter: "canceled",
        selectionHelper: "getOrderStatusForCurrentUser",
      },
      message
    );
  }
});

test("payment context escalates paid and unpaid personal follow-ups to payment candidates", () => {
  const context = createSupportTopicContext({
    topic: "payment",
    source: "starter_prompt",
  });

  assert.equal(detectTopicAccountEscalation({ message: "paid", context }), null);
  assert.deepEqual(
    detectTopicAccountEscalation({ message: "my paid order", context }),
    {
      statusFilter: "paid",
      selectionHelper: "getPaymentStatusForCurrentUser",
    }
  );
  assert.deepEqual(
    detectTopicAccountEscalation({ message: "my unpaid booking", context }),
    {
      statusFilter: "payment_pending",
      selectionHelper: "getPaymentStatusForCurrentUser",
    }
  );
  assert.deepEqual(
    detectTopicAccountEscalation({ message: "my payment not due", context }),
    {
      statusFilter: "payment_not_due",
      selectionHelper: "getPaymentStatusForCurrentUser",
    }
  );
});

test("booking context escalates service-state personal follow-ups to order candidates", () => {
  const context = createSupportTopicContext({
    topic: "booking",
    source: "starter_prompt",
  });

  assert.deepEqual(
    detectTopicAccountEscalation({ message: "my scheduled booking", context }),
    {
      statusFilter: "scheduled",
      selectionHelper: "getOrderStatusForCurrentUser",
    }
  );
  assert.deepEqual(
    detectTopicAccountEscalation({ message: "my requested booking", context }),
    {
      statusFilter: "requested",
      selectionHelper: "getOrderStatusForCurrentUser",
    }
  );
});

test("provider context, missing context, and long messages do not escalate", () => {
  const provider = createSupportTopicContext({
    topic: "provider_onboarding",
    source: "starter_prompt",
  });
  const cancellation = createSupportTopicContext({
    topic: "cancellation",
    source: "starter_prompt",
  });

  assert.equal(
    detectTopicAccountEscalation({
      message: "my scheduled booking",
      context: provider,
    }),
    null
  );
  assert.equal(
    detectTopicAccountEscalation({ message: "my already scheduled booking" }),
    null
  );
  assert.equal(
    detectTopicAccountEscalation({
      message:
        "This is a longer unrelated message about a completely different issue",
      context: cancellation,
    }),
    null
  );
});
