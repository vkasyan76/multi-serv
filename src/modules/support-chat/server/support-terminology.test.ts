import test from "node:test";
import assert from "node:assert/strict";

import { SUPPORTED_APP_LANGS } from "@/lib/i18n/app-lang";
import deSupportChat from "@/i18n/messages/de/supportChat.json";
import ptSupportChat from "@/i18n/messages/pt/supportChat.json";
import plSupportChat from "@/i18n/messages/pl/supportChat.json";
import roSupportChat from "@/i18n/messages/ro/supportChat.json";
import ukSupportChat from "@/i18n/messages/uk/supportChat.json";
import { buildSupportPrompt } from "@/modules/support-chat/server/build-support-prompt";
import { getSupportTerminology } from "@/modules/support-chat/server/support-terminology";

test("support terminology exists for every launched locale", () => {
  for (const locale of SUPPORTED_APP_LANGS) {
    const terms = getSupportTerminology(locale);

    assert.ok(terms.providerRole, `${locale}: providerRole`);
    assert.ok(terms.providerProfile, `${locale}: providerProfile`);
    assert.ok(terms.providerSettings, `${locale}: providerSettings`);
    assert.ok(terms.paymentsArea, `${locale}: paymentsArea`);
    assert.ok(terms.payouts, `${locale}: payouts`);
    assert.ok(terms.stripeOnboarding, `${locale}: stripeOnboarding`);
    assert.ok(terms.requestedStatus, `${locale}: requestedStatus`);
    assert.ok(terms.scheduledStatus, `${locale}: scheduledStatus`);
    assert.ok(terms.awaitingProviderConfirmation, `${locale}: awaitingProviderConfirmation`);
  }
});

test("German support terminology prefers Dienstleister without banning Anbieter globally", () => {
  const terms = getSupportTerminology("de");

  assert.equal(terms.providerRole, "Dienstleister");
  assert.equal(terms.requestedStatus, "angefragt");
  assert.equal(terms.scheduledStatus, "geplant");
  assert.equal(
    terms.awaitingProviderConfirmation,
    "wartet auf Bestätigung durch den Dienstleister"
  );
  assert.ok(terms.avoidTerms?.includes("Provider-Profil"));
  assert.ok(terms.avoidTerms?.includes("Provider"));
  assert.ok(terms.avoidTerms?.includes("Anbieterprofil"));
  assert.equal(terms.avoidTerms?.includes("Anbieter"), false);

  assert.match(deSupportChat.suggestions.provider, /Dienstleister/);
  assert.match(deSupportChat.suggestionPrompts.provider, /Dienstleister/);
  assert.doesNotMatch(deSupportChat.suggestions.provider, /Provider|Anbieterprofil/);
  assert.doesNotMatch(
    deSupportChat.suggestionPrompts.provider,
    /Provider|Anbieterprofil/
  );
});

test("support starter copy follows profile terminology in non-German locales", () => {
  assert.match(ptSupportChat.suggestions.provider, /prestador de serviços/i);
  assert.match(ptSupportChat.suggestionPrompts.provider, /prestador de serviços/i);
  assert.doesNotMatch(ptSupportChat.suggestions.provider, /fornecedor/i);
  assert.doesNotMatch(ptSupportChat.suggestionPrompts.provider, /fornecedor/i);

  assert.match(plSupportChat.suggestions.provider, /usługodawc/i);
  assert.match(plSupportChat.suggestionPrompts.provider, /usługodawc/i);
  assert.doesNotMatch(plSupportChat.suggestions.provider, /dostawc/i);
  assert.doesNotMatch(plSupportChat.suggestionPrompts.provider, /dostawc/i);

  assert.match(roSupportChat.suggestions.provider, /prestator de servicii/i);
  assert.match(roSupportChat.suggestionPrompts.provider, /prestator de servicii/i);
  assert.doesNotMatch(roSupportChat.suggestions.provider, /furnizor/i);
  assert.doesNotMatch(roSupportChat.suggestionPrompts.provider, /furnizor/i);

  assert.match(ukSupportChat.suggestions.provider, /постачальником послуг/i);
  assert.match(ukSupportChat.suggestionPrompts.provider, /постачальником послуг/i);
});

test("support prompt includes active locale terminology guidance", () => {
  const prompt = buildSupportPrompt({
    message: "Erzähl mir mehr über Stripe-Onboarding für Auszahlungen",
    locale: "de",
    sources: [],
  });

  assert.match(prompt.instructions, /Locale terminology:/);
  assert.match(prompt.instructions, /Dienstleister/);
  assert.match(prompt.instructions, /Dienstleister-Einstellungen/);
  assert.match(prompt.instructions, /Zahlungen/);
  assert.match(prompt.instructions, /Auszahlungen/);
  assert.match(prompt.instructions, /Stripe-Einrichtung/);
  assert.match(prompt.instructions, /requested="angefragt"/);
  assert.match(prompt.instructions, /scheduled="geplant"/);
  assert.match(prompt.instructions, /wartet auf Bestätigung durch den Dienstleister/);
  assert.match(
    prompt.instructions,
    /Do not quote raw English lifecycle labels such as "Requested", "Scheduled", or "Awaiting provider confirmation"/
  );
  assert.match(prompt.instructions, /Provider-Profil/);
  assert.doesNotMatch(prompt.instructions, /Avoid.*Anbieter[,.\n]/);
});
