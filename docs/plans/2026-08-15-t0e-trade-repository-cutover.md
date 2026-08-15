# T0E Trade Repository Cutover Implementation Plan

**Goal:** Move trade discovery and comparison reads behind JSON/PostgreSQL repository adapters without changing the public API contract.

**Architecture:** The route owns validation and authorization, a pure service owns name-based matching, and repository adapters own user and collection reads. JSON remains the default; PostgreSQL is opt-in through `PERSISTENCE_DRIVER=postgres`.

**Tech stack:** Node.js, Express, built-in test runner, JSON files, PostgreSQL pool adapter.

## Tasks

1. Add a pure trade matching service and cover name normalization, printing aggregation, and deterministic output.
2. Add JSON and PostgreSQL trade repositories that reuse binder and wishlist adapters.
3. Replace direct file reads with an injectable async trade router while preserving response and error shapes.
4. Add repository and route contract tests, then run the full backend test and syntax gates.

## Safety constraints

- Exclude the requesting user from discovery.
- Require the target user to own the selected binder.
- Require the requesting user to own the selected wishlist.
- Parameterize PostgreSQL queries and cap discovery at 20 users.
- Do not expose password, email, token, or private collection fields.
