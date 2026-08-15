# T0C Binder Repository Cutover Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use godmode:task-runner to implement this plan task-by-task.

**Goal:** Move binder persistence behind JSON and PostgreSQL adapters without changing HTTP behavior.

**Architecture:** Mirror the approved wishlist repository boundary. Express owns validation and authorization, while adapters own persistence and normalize the same API shape.

**Tech Stack:** Node.js, Express 5, node:test, JSON, parameterized PostgreSQL SQL.

---

### Task 1: Binder adapters

Create `src/repositories/binder/` with model normalization, atomic JSON persistence, and parameterized PostgreSQL CRUD/card persistence.

### Task 2: Route cutover

Create `routes/binder-router.js`, inject the adapter, preserve current Spanish errors and status codes, and switch the binder import in `index.js`.

### Task 3: Tests and documentation

Add JSON lifecycle, SQL boundary, route validation, and ownership tests. Document the incremental persistence state.

### Verification

Run `npm test`, `node --check` for new JavaScript, and `git diff --check`. Expected: zero failures.
