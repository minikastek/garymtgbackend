# Trade binder opt-in

## Goal

Make binder sharing explicit and private by default before exposing card-level
trade inventory.

## Contract

- Every normalized binder includes a boolean `tradeEnabled` field.
- Missing or legacy values normalize to `false`.
- Owners may set the field during binder creation or update.
- Non-boolean API values are rejected instead of coerced.
- Trade discovery returns only binders owned by the selected player whose
  `tradeEnabled` value is exactly `true`.
- Direct comparison requests enforce the same predicate, so knowing a private
  binder ID cannot bypass the sharing boundary.
- JSON and PostgreSQL persistence use the same contract. PostgreSQL reuses the
  existing `collections.trade_enabled` column.

## Follow-up

The next independent endpoint may expose cards for one opted-in binder. Trade
proposal persistence and accepted-card reservations remain dependent on the
separate lifecycle persistence PR.

## Verified outcome

- A direct comparison regression test reproduced the original privacy bypass
  (`200` for a private binder) before the fix and now receives `404`.
- Nine focused binder/trade tests and all 41 backend tests pass.
- Lint and whitespace checks pass; no dependencies changed.
- Durable lesson: every public-resource predicate must be enforced both during
  discovery and during direct ID lookup. Filtering lists alone is not an
  authorization boundary.
- Known follow-up: the legacy trade router still reads JSON files directly, so
  PostgreSQL-backed trade discovery requires a separate repository refactor.
