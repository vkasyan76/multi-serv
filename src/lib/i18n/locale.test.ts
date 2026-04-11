import test from "node:test";
import assert from "node:assert/strict";

import { SUPPORTED_APP_LANGS } from "@/lib/i18n/app-lang";
import { getCurrencyInputConfig } from "@/lib/i18n/locale";

test("currency input config never reuses the decimal separator as group separator", () => {
  for (const appLang of SUPPORTED_APP_LANGS) {
    const { decimalSeparator, thousandSeparator, placeholder } =
      getCurrencyInputConfig(appLang);

    assert.ok(decimalSeparator, `${appLang}: decimal separator missing`);
    assert.ok(placeholder.length > 0, `${appLang}: placeholder missing`);

    if (thousandSeparator !== undefined) {
      assert.notEqual(
        thousandSeparator,
        decimalSeparator,
        `${appLang}: decimal and group separators must differ`
      );
    }
  }
});
