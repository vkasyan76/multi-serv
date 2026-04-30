import test from "node:test";
import assert from "node:assert/strict";

import { createSupportTopicContext } from "@/modules/support-chat/server/topics";
import { detectTopicAccountEscalation } from "@/modules/support-chat/server/topic-account-escalation";

test("cancellation context escalates scheduled follow-ups to cancellation candidates", () => {
  const context = createSupportTopicContext({
    topic: "cancellation",
    source: "starter_prompt",
  });

  for (const message of [
    "already scheduled",
    "ya programado",
    "déjà planifiée",
    "già programmata",
    "bereits geplant",
    "już zaplanowane",
    "já agendado",
    "deja programata",
    "вже заплановане",
  ]) {
    assert.deepEqual(
      detectTopicAccountEscalation({ message, context }),
      {
        statusFilter: "scheduled",
        selectionHelper: "canCancelOrderForCurrentUser",
      },
      message
    );
  }
});

test("cancellation context escalates requested and canceled follow-ups", () => {
  const context = createSupportTopicContext({
    topic: "cancellation",
    source: "starter_prompt",
  });

  for (const message of [
    "awaiting confirmation",
    "solicitado",
    "demandée",
    "richiesta",
    "angefragt",
    "oczekuje na potwierdzenie",
    "aguardando confirmação",
    "in asteptarea confirmarii",
    "очікує підтвердження",
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

  for (const message of [
    "canceled",
    "cancelado",
    "annulée",
    "annullata",
    "storniert",
    "anulowane",
    "anulado",
    "anulata",
    "скасоване",
  ]) {
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

test("payment context escalates paid and unpaid follow-ups to payment candidates", () => {
  const context = createSupportTopicContext({
    topic: "payment",
    source: "starter_prompt",
  });

  assert.deepEqual(detectTopicAccountEscalation({ message: "paid", context }), {
    statusFilter: "paid",
    selectionHelper: "getPaymentStatusForCurrentUser",
  });
  assert.deepEqual(
    detectTopicAccountEscalation({ message: "unpaid", context }),
    {
      statusFilter: "payment_pending",
      selectionHelper: "getPaymentStatusForCurrentUser",
    }
  );
  assert.deepEqual(
    detectTopicAccountEscalation({ message: "not due", context }),
    {
      statusFilter: "payment_not_due",
      selectionHelper: "getPaymentStatusForCurrentUser",
    }
  );
});

test("booking context escalates service-state follow-ups to order candidates", () => {
  const context = createSupportTopicContext({
    topic: "booking",
    source: "starter_prompt",
  });

  assert.deepEqual(
    detectTopicAccountEscalation({ message: "scheduled", context }),
    {
      statusFilter: "scheduled",
      selectionHelper: "getOrderStatusForCurrentUser",
    }
  );
  assert.deepEqual(
    detectTopicAccountEscalation({ message: "requested", context }),
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
    detectTopicAccountEscalation({ message: "scheduled", context: provider }),
    null
  );
  assert.equal(
    detectTopicAccountEscalation({ message: "вже заплановане" }),
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
