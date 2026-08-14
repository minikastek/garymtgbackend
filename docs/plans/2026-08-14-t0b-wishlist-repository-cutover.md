# T0B Wishlist Repository Cutover Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use godmode:task-runner to implement this plan task-by-task.

**Goal:** Move wishlist API persistence behind adapters without changing HTTP behavior.

**Architecture:** Express retains validation and ownership checks. JSON remains the default repository; PostgreSQL is explicitly selected after migration readiness. This vertical slice establishes the pattern before other resources move.

**Tech Stack:** Node.js, Express 5, node:test, JSON, parameterized PostgreSQL SQL.

---

### Task 1: Repository adapters

Create `src/repositories/wishlist/` with normalized JSON and PostgreSQL implementations for list, lookup, CRUD, and card mutations. Keep all SQL values parameterized.

### Task 2: Route cutover

Create `routes/wishlist-router.js`, inject its repository, preserve Spanish errors and status codes, and switch the existing mount import in `index.js`.

### Task 3: Tests and operations

Add JSON lifecycle, SQL injection-boundary, route validation, and ownership tests. Document `PERSISTENCE_DRIVER` and incremental rollback behavior.

### Verification

Run `npm test`, `node --check` for new JavaScript, and `git diff --check`. Expected: zero failures.
