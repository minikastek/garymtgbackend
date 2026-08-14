# GaryMTG Backend

Express API for GaryMTG authentication, decks, binders, wishlists, card lookup, and early trade matching.

## Persistence migration foundation

The HTTP routes still use their existing JSON files. The `db/` directory is the first PostgreSQL migration slice and intentionally does not change API behavior yet.

1. Copy `.env.example` to `.env` and set `DATABASE_URL` plus a strong `JWT_SECRET`.
2. Reconcile the repository's existing `package-lock.json` change, then add the `pg` runtime package with `npm install pg`.
3. Create an empty PostgreSQL database.
4. Run `npm run db:migrate` to apply pending versioned migrations transactionally.
5. Back up `users.json`, `decks.json`, `binders.json`, and `wishlists.json`.
6. Run `npm run db:import-json` to upsert users and collections into PostgreSQL.

The import is idempotent for current records: users and collections are upserted, and each imported collection's card rows are replaced inside one transaction. JSON remains the source of truth until the follow-up `T0B` route cutover.

## Wishlist repository cutover

Wishlist routes now depend on a repository contract. `PERSISTENCE_DRIVER=json` preserves local behavior and remains the default. After migrations, import, and `pg` installation are complete, set `PERSISTENCE_DRIVER=postgres` to use PostgreSQL for wishlist requests.

This is incremental: decks, binders, and trading remain JSON-backed until their repository slices are implemented. Keep the JSON files until all route migrations have verified parity.

## Configuration

Production startup must provide `JWT_SECRET`. PostgreSQL commands additionally require `DATABASE_URL`. Pool limits and timeouts are configurable through `.env.example`.

## Commands

```sh
npm test
npm run db:migrate
npm run db:import-json
```
