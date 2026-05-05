import { SUPPORT_TRIAGE_EVAL_CASES } from "@/modules/support-chat/testing/triage-test-cases";
import { classifySupportIntent } from "@/modules/support-chat/server/intent-triage";

function matchesExpected(
  actual: Awaited<ReturnType<typeof classifySupportIntent>>,
  expected: (typeof SUPPORT_TRIAGE_EVAL_CASES)[number]["expected"],
  notIntent?: (typeof SUPPORT_TRIAGE_EVAL_CASES)[number]["notIntent"],
) {
  if (!actual.ok) return false;
  if (notIntent && actual.result.intent === notIntent) return false;

  return Object.entries(expected).every(
    ([key, value]) =>
      actual.result[key as keyof typeof actual.result] === value,
  );
}

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    console.log(
      "[support-chat:triage] skipped live triage evals because OPENAI_API_KEY is not set.",
    );
    return;
  }

  const failures: string[] = [];

  for (const testCase of SUPPORT_TRIAGE_EVAL_CASES) {
    const result = await classifySupportIntent({
      message: testCase.message,
      locale: testCase.locale,
      threadId: `triage-eval-${testCase.id}`,
      activeTopic: testCase.memory?.activeTopic ?? null,
      hasSelectedOrderContext:
        testCase.memory?.hasSelectedOrderContext ?? false,
      conversationMemory: testCase.memory,
    });

    if (!matchesExpected(result, testCase.expected, testCase.notIntent)) {
      failures.push(
        `${testCase.id}: expected ${JSON.stringify({
          ...testCase.expected,
          notIntent: testCase.notIntent,
        })}, got ${JSON.stringify(result)}`,
      );
    }
  }

  if (failures.length) {
    console.error("[support-chat:triage] failures:");
    for (const failure of failures) console.error(`- ${failure}`);
    process.exitCode = 1;
    return;
  }

  console.log(
    `[support-chat:triage] passed ${SUPPORT_TRIAGE_EVAL_CASES.length} live evals.`,
  );
}

void main();
