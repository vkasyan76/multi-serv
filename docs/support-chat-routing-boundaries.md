# Support Chat Routing Boundaries

Patch 1 classification for the transition away from regex-driven account
support.

## Architecture Principle

Model understands meaning. Server enforces authority. Regex is for
safety/fallback only, not primary conversation intelligence.

## Keep Deterministic

These paths should remain server-owned even after model triage exists:

- unsafe mutation blocking
- broad history/export blocking
- exact ID/reference detection
- selected-order token validation
- candidate action token validation
- ownership checks
- helper allowlist
- result limits

Reason: these are authority, privacy, and data-boundary decisions. The model may
classify intent, but it must not choose database queries, helper names, order IDs,
or perform mutations.

## Fallback For Now

These paths currently keep account-aware support usable, but should stop growing:

- multilingual account lookup phrase matching
- "my scheduled booking" style phrase matching
- topic continuation phrase lists
- natural-language candidate lookup routing

Reason: these are conversation-understanding problems. Expanding regex here makes
the assistant rigid and locale-heavy.

## Remove Or Demote Later

After structured triage and reality evals prove the replacement path, demote or
remove regex that tries to infer broad meaning from translated phrases.

Keep only the fallback pieces that are simpler and safer than model triage.

## Patch Sequence Dependency

Do not remove legacy phrase paths in Patch 1. Patch 1 only labels boundaries so
future patches can replace the correct parts in order:

1. Add safe short conversation memory.
2. Add structured model triage and evidence logging.
3. Route high-confidence triage through server eligibility.
4. Add grounded answer flow.
5. Demote legacy phrase routing.
