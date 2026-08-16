# T1B Trade Profile Persistence Plan

**Goal:** Persist opt-in trade location preferences consistently in JSON and PostgreSQL without exposing them through HTTP yet.

**Architecture:** A shared normalizer enforces storage-safe defaults, repository adapters preserve the existing JSON/PostgreSQL driver boundary, and a forward-only migration adds candidate-controlled location visibility.

## Contract

- Profiles belong to exactly one user and default to trading disabled.
- Country codes are normalized to two uppercase letters.
- Coordinates are stored only as a valid latitude/longitude pair.
- Search radius is constrained to 1-500 km.
- Visibility is allowlisted to country, region, or city and defaults to country.
- JSON updates preserve all unrelated account fields and replace files atomically.
- PostgreSQL reads and upserts are fully parameterized and return null for unknown users.

## Follow-up slice

Add authenticated owner-only profile read/update endpoints with strict request validation, then wire location discovery after the ranking-domain PR lands.
