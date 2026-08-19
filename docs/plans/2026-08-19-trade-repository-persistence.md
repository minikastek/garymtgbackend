# Trade repository persistence

## Goal

Persist trade lifecycle aggregates through the configured JSON or PostgreSQL
driver without coupling storage to HTTP routes or binder reservation rules.

## Contract

- `create(trade)` stores a normalized lifecycle aggregate.
- `findById(id)` returns one normalized trade or `null`.
- `listByParticipant(userId)` returns trades where the user is either party,
  newest first.
- `replace(trade)` stores a domain-approved lifecycle update or returns `null`
  when the trade no longer exists.
- PostgreSQL writes to proposals and items are transactional and all external
  values are parameterized.
- Stored items retain binder, card, side, quantity, and ordering references.

## Boundaries

- The lifecycle model remains responsible for authorization and transitions.
- API price snapshots, notifications, accepted-card reservations, and atomic
  binder transfer are separate slices.
- `replace` is an internal persistence primitive. Route handlers must not use it
  to bypass lifecycle authorization.

## Verified outcome

- Implemented JSON and PostgreSQL adapters behind the configured persistence
  driver.
- Evolved the existing proposal schema instead of adding a competing trade
  store.
- Confirmed 41 backend tests pass, including lifecycle persistence,
  parameterized participant lookup, and transactional item writes.
- The next slice is accepted-trade binder reservation with atomic inventory
  checks; proposal creation remains intentionally non-reserving.
