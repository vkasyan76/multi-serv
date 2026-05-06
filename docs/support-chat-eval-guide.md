# Support Chat Eval Guide

This guide explains which support-chat checks are local/offline and which ones
depend on a live OpenAI key.

## Local Checks

Run these before merging support-chat routing, helper, grounding, or admin
evidence changes:

```txt
npm run test:support-chat:intent-triage
npm run test:support-chat:account-aware-routing
npm run test:support-chat:account-aware-helpers
npm run test:support-chat:phase2-account-aware
```

These checks do not require live model quality. The Phase 2 account-aware runner
uses explicit triage fixtures for model-understanding cases so it can validate
the server contract deterministically:

```txt
model proposes intent -> server checks eligibility -> helper retrieves bounded DTOs
```

Use this runner to verify:

- exact references still route through server-owned helpers
- vague prompts do not bypass triage through regex
- high-confidence triage fixtures map only to allowed helpers
- unsafe, broad, anonymous, and unsupported cases do not execute helpers
- selected-order follow-ups continue to use signed selected-order context

## Live Triage Evals

Run this only when `OPENAI_API_KEY` is configured:

```txt
npm run test:support-chat:triage
```

To save a review artifact:

```txt
npm run test:support-chat:triage -- --json --out tmp/support-chat-triage-live.json
```

Without `OPENAI_API_KEY`, the script skips cleanly and can still write a skipped
artifact with the same `--json --out` flags.

Live triage evals check whether the model understands representative messages,
such as:

- German scheduled-booking follow-up
- English scheduled-booking follow-up
- French cancellation follow-up
- Italian paid-payment follow-up
- generic policy question that must not route to account helpers
- unsafe mutation and broad export requests

## Phase 1 Knowledge Regression

`npm run test:support-chat:phase1` checks broad support knowledge behavior. It is
separate from account-aware triage/routing.

Known unrelated Phase 1 failures are documented in `AGENTS.md`. Do not use those
known cross-locale failures to block account-aware routing work unless the
current change modifies retrieval, knowledge packs, or localized support copy.

## Updating Evals

When changing account-aware behavior:

- update Phase 2 fixtures when the server contract changes
- prefer explicit triage fixtures over regex phrase expansion
- keep live model evals separate from offline server-contract tests
- do not add helper routes unless there is an eligibility check and a test
- do not backfill broad account history behavior through eval expectations

When changing model instructions:

- run live triage evals with an artifact
- review actual triage intent, topic, status filter, confidence, and reason
- keep server eligibility as the final authority even if model output looks good
