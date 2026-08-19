# Trade Lifecycle Foundation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use godmode:task-runner to implement this plan task-by-task.

**Goal:** Define and verify the trade lifecycle shared by future persistence, API, notification, pricing, and binder-update slices.

**Architecture:** Keep lifecycle rules in a pure model module with immutable transitions and structured domain errors. Routes and repositories will call this module rather than duplicating authorization or state rules.

**Tech Stack:** Node.js, CommonJS, built-in `node:test`, `node:assert/strict`.

---

### Task 1: Specify lifecycle behavior

**Files:**
- Create: `docs/plans/2026-08-18-trade-lifecycle-design.md`
- Create: `docs/plans/2026-08-18-trade-lifecycle-foundation.md`

Record states, actors, transition constraints, coordination privacy, idempotency, exclusions, and future counter-offer compatibility.

### Task 2: Test the aggregate and transitions

**Files:**
- Create: `test/trade-lifecycle.test.js`

Cover aggregate creation, invalid participants, recipient acceptance and decline, proposer cancellation, coordination validation, participant confirmations, idempotency, and completion after both confirmations.

Run: `node --test test/trade-lifecycle.test.js`

Expected: tests fail before the lifecycle module exists, then pass after Task 3.

### Task 3: Implement the lifecycle model

**Files:**
- Create: `src/repositories/trade/model.js`

Implement normalized immutable aggregates, allowlisted coordination data, structured lifecycle errors, and actor-aware state transitions.

Run: `npm test`

Expected: all backend tests pass without modifying `package-lock.json`.

