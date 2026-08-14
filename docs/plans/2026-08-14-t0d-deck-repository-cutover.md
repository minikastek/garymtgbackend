# T0D Deck Repository Cutover Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use godmode:task-runner to implement this plan task-by-task.

**Goal:** Move deck persistence behind JSON and PostgreSQL adapters while preserving deck legality behavior.

**Architecture:** The route/domain layer remains responsible for ownership, board selection, copy limits, and legality. Repositories persist validated whole-deck snapshots, mapping main and sideboard to `collection_cards.board`.

**Tech Stack:** Node.js, Express 5, node:test, JSON, parameterized PostgreSQL SQL.

---

### Task 1: Deck adapters

Create `src/repositories/deck/` with board normalization, atomic JSON snapshots, and transactional PostgreSQL replacement.

### Task 2: Route cutover

Create `routes/deck-router.js`, retain all CRUD and card endpoints, keep legality utilities storage-agnostic, and switch the deck import in `index.js`.

### Task 3: Regression coverage

Test board persistence, SQL parameterization, ownership, and rejection of copy-limit violations before repository writes.

### Verification

Run `npm test`, `node --check` for new modules, and `git diff --check`. Expected: zero failures.
