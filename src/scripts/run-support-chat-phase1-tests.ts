import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import type { GenerateSupportResponseResult } from "@/modules/support-chat/server/generate-support-response";
import {
  SUPPORT_CHAT_PHASE1_TEST_CASES,
  type SupportChatPhase1TestCase,
} from "@/modules/support-chat/testing/phase1-test-cases";

type RunnerArgs = {
  caseId?: string;
  json: boolean;
  out?: string;
};

type SupportChatPhase1TestResult = {
  id: string;
  category: SupportChatPhase1TestCase["category"];
  locale: SupportChatPhase1TestCase["locale"];
  prompt: string;
  expectedDisposition: SupportChatPhase1TestCase["expectedDisposition"];
  actualDisposition: GenerateSupportResponseResult["disposition"];
  expectedNeedsHumanSupport: boolean;
  actualNeedsHumanSupport: boolean;
  responseOrigin: GenerateSupportResponseResult["responseOrigin"];
  sourceCount: number;
  topSourceIds: string[];
  assistantMessage: string;
  checks: {
    dispositionMatches: boolean;
    needsHumanSupportMatches: boolean;
    answeredHasSources: boolean;
    unsupportedIsNotAnswered: boolean;
  };
  expectedBehavior: string[];
  forbiddenBehavior: string[];
};

function parseArgs(argv: string[]): RunnerArgs {
  const args: RunnerArgs = {
    json: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];

    if (value === "--json") {
      args.json = true;
      continue;
    }

    if (value === "--case") {
      args.caseId = argv[index + 1];
      index += 1;
      continue;
    }

    if (value === "--out") {
      args.out = argv[index + 1];
      index += 1;
    }
  }

  return args;
}

function pickCases(caseId?: string) {
  if (!caseId) return SUPPORT_CHAT_PHASE1_TEST_CASES;

  const match = SUPPORT_CHAT_PHASE1_TEST_CASES.find((item) => item.id === caseId);
  if (!match) {
    throw new Error(
      `Unknown support-chat Phase 1 test case "${caseId}".`,
    );
  }

  return [match];
}

function summarizeSources(result: GenerateSupportResponseResult) {
  return result.sources.slice(0, 3).map((source) => source.documentId);
}

function evaluateCase(
  testCase: SupportChatPhase1TestCase,
  result: GenerateSupportResponseResult,
): SupportChatPhase1TestResult {
  const checks = {
    dispositionMatches: result.disposition === testCase.expectedDisposition,
    needsHumanSupportMatches:
      result.needsHumanSupport === testCase.expectedNeedsHumanSupport,
    answeredHasSources:
      result.disposition !== "answered" || result.sources.length > 0,
    unsupportedIsNotAnswered:
      testCase.expectedDisposition !== "unsupported_account_question" ||
      result.disposition !== "answered",
  };

  return {
    id: testCase.id,
    category: testCase.category,
    locale: testCase.locale,
    prompt: testCase.prompt,
    expectedDisposition: testCase.expectedDisposition,
    actualDisposition: result.disposition,
    expectedNeedsHumanSupport: testCase.expectedNeedsHumanSupport,
    actualNeedsHumanSupport: result.needsHumanSupport,
    responseOrigin: result.responseOrigin,
    sourceCount: result.sources.length,
    topSourceIds: summarizeSources(result),
    assistantMessage: result.assistantMessage,
    checks,
    expectedBehavior: testCase.expectedBehavior,
    forbiddenBehavior: testCase.forbiddenBehavior,
  };
}

function formatResult(result: SupportChatPhase1TestResult) {
  const checkEntries = Object.entries(result.checks).map(([key, passed]) => {
    return `${passed ? "PASS" : "FAIL"} ${key}`;
  });

  return [
    `\n[${result.id}] ${result.category} (${result.locale})`,
    `Prompt: ${result.prompt}`,
    `Disposition: expected=${result.expectedDisposition} actual=${result.actualDisposition}`,
    `Needs human: expected=${result.expectedNeedsHumanSupport} actual=${result.actualNeedsHumanSupport}`,
    `Origin: ${result.responseOrigin}`,
    `Sources: ${result.sourceCount} ${
      result.topSourceIds.length ? `(${result.topSourceIds.join(", ")})` : ""
    }`,
    ...checkEntries,
    `Expected behavior: ${result.expectedBehavior.join(" | ")}`,
    `Forbidden behavior: ${result.forbiddenBehavior.join(" | ")}`,
    `Answer: ${result.assistantMessage}`,
  ].join("\n");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const cases = pickCases(args.caseId);
  const results: SupportChatPhase1TestResult[] = [];
  let generateSupportResponse: (
    input: Parameters<
      typeof import("@/modules/support-chat/server/generate-support-response")["generateSupportResponse"]
    >[0],
  ) => Promise<GenerateSupportResponseResult>;

  try {
    ({ generateSupportResponse } = await import(
      "@/modules/support-chat/server/generate-support-response"
    ));
  } catch (error: unknown) {
    if (
      error instanceof Error &&
      /OPENAI_SUPPORT_CHAT_MODEL|OPENAI_SUPPORT_CHAT_MODEL_VERSION/.test(
        error.message,
      )
    ) {
      console.error(
        "[support-chat phase1 tests] Support-chat OpenAI env vars are not visible to the runner process. Ensure OPENAI_SUPPORT_CHAT_MODEL and OPENAI_SUPPORT_CHAT_MODEL_VERSION are loaded before running the Phase 1 suite.",
      );
      process.exitCode = 1;
      return;
    }

    throw error;
  }

  for (const testCase of cases) {
    const response = await generateSupportResponse({
      message: testCase.prompt,
      locale: testCase.locale,
    });

    const result = evaluateCase(testCase, response);
    results.push(result);
  }

  const failedCount = results.filter((result) =>
    Object.values(result.checks).some((passed) => !passed),
  ).length;

  if (args.json) {
    const payload = JSON.stringify(results, null, 2);
    if (args.out) {
      await mkdir(path.dirname(args.out), { recursive: true });
      await writeFile(args.out, `${payload}\n`, "utf8");
    } else {
      console.log(payload);
    }
  } else {
    console.log(
      `Support Chat Phase 1 test run: ${results.length} case(s), ${failedCount} structured failure(s).`,
    );
    for (const result of results) {
      console.log(formatResult(result));
    }
  }

  if (args.out && !args.json) {
    await mkdir(path.dirname(args.out), { recursive: true });
    await writeFile(`${args.out}`, `${JSON.stringify(results, null, 2)}\n`, "utf8");
  }

  if (failedCount > 0) {
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error("[support-chat phase1 tests] runner failed", error);
  process.exitCode = 1;
});
