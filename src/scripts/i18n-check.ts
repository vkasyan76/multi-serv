import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import {
  LAUNCHED_APP_LANGS,
  REQUIRED_NAMESPACES,
  assertLaunchedLocalesAreSupported,
  type RequiredNamespace,
} from "../i18n/rollout";

// Phase 3 (Commit 4): run via `npm run test:i18n:messages`.
type JsonObject = Record<string, unknown>;

function isPlainObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function flattenKeys(obj: JsonObject, prefix = ""): string[] {
  const out: string[] = [];

  for (const [key, value] of Object.entries(obj)) {
    const next = prefix ? `${prefix}.${key}` : key;
    if (isPlainObject(value)) {
      out.push(...flattenKeys(value, next));
    } else {
      out.push(next);
    }
  }

  return out;
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

function loadNamespace(lang: string, ns: RequiredNamespace): JsonObject {
  const file = path.resolve(process.cwd(), "src", "i18n", "messages", lang, `${ns}.json`);

  if (!existsSync(file)) {
    throw new Error(`[i18n-check] Missing file: ${file}`);
  }

  const raw = readFileSync(file, "utf8");
  const parsed = JSON.parse(raw) as unknown;

  if (!isPlainObject(parsed)) {
    throw new Error(`[i18n-check] Expected JSON object in: ${file}`);
  }

  return parsed;
}

function main() {
  assertLaunchedLocalesAreSupported();

  // EN is the baseline schema; launched locales must include all baseline keys.
  const baselineLang = "en";
  const failures: string[] = [];
  const warnings: string[] = [];

  for (const ns of REQUIRED_NAMESPACES) {
    const baseline = loadNamespace(baselineLang, ns);
    const baselineKeys = uniqueSorted(flattenKeys(baseline));
    const baselineSet = new Set(baselineKeys);

    for (const lang of LAUNCHED_APP_LANGS) {
      const localized = loadNamespace(lang, ns);
      const localizedKeys = uniqueSorted(flattenKeys(localized));
      const localizedSet = new Set(localizedKeys);

      const missing = baselineKeys.filter((k) => !localizedSet.has(k));
      if (missing.length > 0) {
        failures.push(
          `[i18n-check] ${lang}/${ns}.json missing ${missing.length} keys:\n` +
            missing.map((k) => `  - ${k}`).join("\n")
        );
      }

      // Extra keys are warning-only to keep cleanup non-blocking.
      const extra = localizedKeys.filter((k) => !baselineSet.has(k));
      if (extra.length > 0) {
        warnings.push(
          `[i18n-check] ${lang}/${ns}.json has ${extra.length} extra keys (warning):\n` +
            extra.map((k) => `  - ${k}`).join("\n")
        );
      }
    }
  }

  if (warnings.length > 0) {
    console.warn(warnings.join("\n\n"));
  }

  if (failures.length > 0) {
    console.error(failures.join("\n\n"));
    process.exit(1);
  }

  console.log(
    `[i18n-check] OK for locales [${LAUNCHED_APP_LANGS.join(", ")}] and namespaces [${REQUIRED_NAMESPACES.join(", ")}]`
  );
}

main();
