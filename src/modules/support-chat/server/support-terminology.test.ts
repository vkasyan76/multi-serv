import test from "node:test";
import assert from "node:assert/strict";

import { SUPPORTED_APP_LANGS } from "@/lib/i18n/app-lang";
import deSupportChat from "@/i18n/messages/de/supportChat.json";
import deProfile from "@/i18n/messages/de/profile.json";
import deLegalTerms from "@/i18n/messages/de/legalTerms.json";
import ptSupportChat from "@/i18n/messages/pt/supportChat.json";
import plSupportChat from "@/i18n/messages/pl/supportChat.json";
import roSupportChat from "@/i18n/messages/ro/supportChat.json";
import ukSupportChat from "@/i18n/messages/uk/supportChat.json";
import { buildAccountRewritePrompt } from "@/modules/support-chat/server/account-aware/account-rewrite-prompt";
import { buildSupportPrompt } from "@/modules/support-chat/server/build-support-prompt";
import {
  formatSupportTerminologyForPrompt,
  getSupportTerminology,
} from "@/modules/support-chat/server/support-terminology";

function assertIncludes(value: string, expected: string, message: string) {
  assert.ok(value.includes(expected), message);
}

test("support terminology exists for every launched locale", () => {
  for (const locale of SUPPORTED_APP_LANGS) {
    const terms = getSupportTerminology(locale);
    const guidance = formatSupportTerminologyForPrompt(locale);

    assert.ok(terms.providerRole, `${locale}: providerRole`);
    assert.ok(terms.providerProfile, `${locale}: providerProfile`);
    assert.ok(terms.providerSettings, `${locale}: providerSettings`);
    assert.ok(terms.paymentsArea, `${locale}: paymentsArea`);
    assert.ok(terms.payouts, `${locale}: payouts`);
    assert.ok(terms.stripeOnboarding, `${locale}: stripeOnboarding`);
    assert.ok(terms.requestedStatus, `${locale}: requestedStatus`);
    assert.ok(terms.scheduledStatus, `${locale}: scheduledStatus`);
    assert.ok(terms.awaitingProviderConfirmation, `${locale}: awaitingProviderConfirmation`);

    assertIncludes(guidance, "Locale terminology:", `${locale}: guidance heading`);
    assertIncludes(guidance, terms.providerRole, `${locale}: providerRole guidance`);
    assertIncludes(guidance, terms.providerProfile, `${locale}: providerProfile guidance`);
    assertIncludes(guidance, terms.paymentsArea, `${locale}: paymentsArea guidance`);
    assertIncludes(guidance, terms.requestedStatus, `${locale}: requested status guidance`);
    assertIncludes(guidance, terms.scheduledStatus, `${locale}: scheduled status guidance`);
    assertIncludes(
      guidance,
      terms.awaitingProviderConfirmation,
      `${locale}: provider confirmation guidance`
    );
    assert.match(guidance, /Prefer booking\/reservation wording/);
    assert.match(guidance, /Avoid internal support-chat terms/);
    assert.match(guidance, /Do not suggest paying the provider directly/);
    assert.match(guidance, /Do not quote raw English lifecycle labels/);
  }
});

test("German support terminology prefers Anbieter while still recognizing Dienstleister input", () => {
  const terms = getSupportTerminology("de");

  assert.equal(terms.providerRole, "Anbieter");
  assert.equal(terms.providerProfile, "Anbieterprofil");
  assert.equal(terms.providerSettings, "Anbieter-Einstellungen");
  assert.equal(terms.requestedStatus, "angefragt");
  assert.equal(terms.scheduledStatus, "geplant");
  assert.equal(
    terms.awaitingProviderConfirmation,
    "wartet auf Bestätigung des Anbieters"
  );
  assert.ok(terms.avoidTerms?.includes("Provider-Profil"));
  assert.ok(terms.avoidTerms?.includes("Provider"));
  assert.ok(terms.avoidTerms?.includes("Dienstleisterprofil"));
  assert.ok(terms.avoidTerms?.includes("Dienstleister-Einstellungen"));
  assert.equal(terms.avoidTerms?.includes("Anbieter"), false);

  assert.match(deSupportChat.suggestions.provider, /Anbieter/);
  assert.match(deSupportChat.suggestionPrompts.provider, /Anbieter/);
  assert.doesNotMatch(deSupportChat.suggestions.provider, /Provider|Dienstleister/);
  assert.doesNotMatch(
    deSupportChat.suggestionPrompts.provider,
    /Provider|Dienstleister/
  );
});

test("German terminology cleanup keeps Dienstleistung service nouns", () => {
  assert.match(deProfile.provider.labels.service_types, /Dienstleistung/);
  assert.match(deProfile.provider.placeholders.services, /Dienstleistungsarten/);
  assert.match(deProfile.confirmation.messages.confirm_intro, /Dienstleistungen/);
  assert.match(deProfile.confirmation.messages.pricing_setup, /Dienstleistungskategorien/);
  assert.match(deLegalTerms.section1.p2, /Dienstleistungsvertrag/);
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
  assert.match(prompt.instructions, /Anbieter/);
  assert.match(prompt.instructions, /Anbieter-Einstellungen/);
  assert.match(prompt.instructions, /Zahlungen/);
  assert.match(prompt.instructions, /Auszahlungen/);
  assert.match(prompt.instructions, /Stripe-Einrichtung/);
  assert.match(prompt.instructions, /requested="angefragt"/);
  assert.match(prompt.instructions, /scheduled="geplant"/);
  assert.match(prompt.instructions, /wartet auf Bestätigung des Anbieters/);
  assert.match(
    prompt.instructions,
    /Do not quote raw English lifecycle labels such as "Requested", "Scheduled", or "Awaiting provider confirmation"/
  );
  assert.match(prompt.instructions, /answer only that narrow question/i);
  assert.match(prompt.instructions, /Do not include broad topic menus/i);
  assert.match(prompt.instructions, /Do not append account lookup offers/i);
  assert.match(prompt.instructions, /Avoid internal support-chat terms/i);
  assert.match(prompt.instructions, /Provider-Profil/);
  assert.match(prompt.instructions, /Dienstleisterprofil/);
  assert.doesNotMatch(prompt.instructions, /Avoid.*Anbieter[,.\n]/);
});

test("account rewrite prompt includes cross-locale terminology guidance", () => {
  for (const locale of SUPPORTED_APP_LANGS) {
    const terms = getSupportTerminology(locale);
    const prompt = buildAccountRewritePrompt({
      locale,
      fallbackAnswer: "I found recent bookings that may match.",
      helperResult: {
        helper: "getSupportOrderCandidatesForCurrentUser",
        resultCategory: "order_candidates",
        candidates: [],
      },
    });

    assertIncludes(
      prompt.instructions,
      "Locale terminology:",
      `${locale}: rewrite guidance heading`
    );
    assertIncludes(
      prompt.instructions,
      terms.providerRole,
      `${locale}: rewrite providerRole guidance`
    );
    assertIncludes(
      prompt.instructions,
      terms.awaitingProviderConfirmation,
      `${locale}: rewrite lifecycle guidance`
    );
    assert.match(prompt.instructions, /Do not expose internal terms/);
    assert.match(prompt.instructions, /Avoid internal support-chat terms/);
    assert.match(prompt.instructions, /Preserve uncertainty, bounded-history limits/);
    assert.match(prompt.instructions, /Write in this locale only/);
  }
});
