import { SUPPORT_TRIAGE_EVAL_CASES } from "@/modules/support-chat/testing/triage-test-cases";
import { classifySupportIntent } from "@/modules/support-chat/server/intent-triage";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

type RunnerArgs = {
  json: boolean;
  out?: string;
};

type TriageEvalResult = {
  id: string;
  locale: string;
  message: string;
  expected: (typeof SUPPORT_TRIAGE_EVAL_CASES)[number]["expected"];
  notIntent?: (typeof SUPPORT_TRIAGE_EVAL_CASES)[number]["notIntent"];
  actual: Awaited<ReturnType<typeof classifySupportIntent>> | null;
  skipped: boolean;
  passed: boolean;
};

function parseArgs(argv: string[]): RunnerArgs {
  const args: RunnerArgs = { json: false };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--json") {
      args.json = true;
      continue;
    }
    if (value === "--out") {
      args.out = argv[index + 1];
      index += 1;
    }
  }

  return args;
}

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
  const args = parseArgs(process.argv.slice(2));

  if (!process.env.OPENAI_API_KEY) {
    const skippedResults: TriageEvalResult[] = SUPPORT_TRIAGE_EVAL_CASES.map(
      (testCase) => ({
        id: testCase.id,
        locale: testCase.locale,
        message: testCase.message,
        expected: testCase.expected,
        notIntent: testCase.notIntent,
        actual: null,
        skipped: true,
        passed: true,
      }),
    );
    await writeResults(args, skippedResults);
    if (!args.json) {
      console.log(
        "[support-chat:triage] skipped live triage evals because OPENAI_API_KEY is not set.",
      );
    }
    return;
  }

  const failures: string[] = [];
  const results: TriageEvalResult[] = [];

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

    const passed = matchesExpected(result, testCase.expected, testCase.notIntent);
    results.push({
      id: testCase.id,
      locale: testCase.locale,
      message: testCase.message,
      expected: testCase.expected,
      notIntent: testCase.notIntent,
      actual: result,
      skipped: false,
      passed,
    });

    if (!passed) {
      failures.push(
        `${testCase.id}: expected ${JSON.stringify({
          ...testCase.expected,
          notIntent: testCase.notIntent,
        })}, got ${JSON.stringify(result)}`,
      );
    }
  }

  await writeResults(args, results);

  if (failures.length) {
    if (!args.json) {
      console.error("[support-chat:triage] failures:");
      for (const failure of failures) console.error(`- ${failure}`);
    }
    process.exitCode = 1;
    return;
  }

  if (!args.json) {
    console.log(
      `[support-chat:triage] passed ${SUPPORT_TRIAGE_EVAL_CASES.length} live evals.`,
    );
  }
}

async function writeResults(args: RunnerArgs, results: TriageEvalResult[]) {
  if (!args.json && !args.out) return;

  const payload = `${JSON.stringify(results, null, 2)}\n`;
  if (args.out) {
    await mkdir(path.dirname(args.out), { recursive: true });
    await writeFile(args.out, payload, "utf8");
    return;
  }

  console.log(payload);
}

void main();
